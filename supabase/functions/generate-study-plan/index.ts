const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_DAYS = 90;
const MAX_TASKS_PER_DAY = 8;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface GeneratedTask {
  subject: string;
  targetMinutes: number;
}

interface GeneratedDay {
  date: string;
  tasks: GeneratedTask[];
}

interface GeneratedPlan {
  title: string;
  advice: string;
  days: GeneratedDay[];
}

interface PlanRequest {
  goal: string;
  startDate: string;
  endDate: string;
  dailyMinutes: number;
  subjects: string[];
  feedback?: string;
  previousPlan?: GeneratedPlan;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayCount(startDate: string, endDate: string): number {
  const ms = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.round(ms / 86400000) + 1;
}

function parseRequest(body: unknown): PlanRequest | string {
  const b = body as Partial<PlanRequest>;
  if (typeof b.goal !== "string" || b.goal.length > 200) return "goal is invalid";
  if (typeof b.startDate !== "string" || !DATE_RE.test(b.startDate)) return "startDate is invalid";
  if (typeof b.endDate !== "string" || !DATE_RE.test(b.endDate)) return "endDate is invalid";
  const days = dayCount(b.startDate, b.endDate);
  if (!(days >= 1 && days <= MAX_DAYS)) return `period must be 1-${MAX_DAYS} days`;
  if (typeof b.dailyMinutes !== "number" || b.dailyMinutes < 15 || b.dailyMinutes > 600) {
    return "dailyMinutes is invalid";
  }
  if (!Array.isArray(b.subjects) || b.subjects.length === 0 || b.subjects.length > 8) {
    return "subjects is invalid";
  }
  if (!b.subjects.every((s) => typeof s === "string" && s.length > 0 && s.length <= 20)) {
    return "subjects is invalid";
  }
  return {
    goal: b.goal.trim(),
    startDate: b.startDate,
    endDate: b.endDate,
    dailyMinutes: Math.round(b.dailyMinutes),
    subjects: b.subjects,
    feedback: typeof b.feedback === "string" ? b.feedback.slice(0, 300) : undefined,
    previousPlan: b.previousPlan,
  };
}

function buildRuleBasedPlan(req: PlanRequest): GeneratedPlan {
  const perSubject = Math.max(
    15,
    Math.floor(req.dailyMinutes / req.subjects.length / 5) * 5,
  );
  const days: GeneratedDay[] = [];
  const count = dayCount(req.startDate, req.endDate);
  for (let i = 0; i < count; i++) {
    days.push({
      date: shiftDate(req.startDate, i),
      tasks: req.subjects.map((subject) => ({ subject, targetMinutes: perSubject })),
    });
  }
  return {
    title: req.goal ? `${req.goal}の学習計画` : "学習計画",
    advice: "1日の目標時間を科目ごとに均等に配分しました。進み具合に合わせて科目の時間を調整してください。",
    days,
  };
}

function buildPrompt(req: PlanRequest): string {
  const lines = [
    `目標: ${req.goal || "未設定"}`,
    `期間: ${req.startDate} から ${req.endDate} まで（毎日を対象とする）`,
    `1日の学習時間の目安: ${req.dailyMinutes}分`,
    `対象科目: ${req.subjects.join("、")}`,
  ];
  if (req.previousPlan) {
    lines.push("", "前回提案した計画（JSON）:", JSON.stringify(req.previousPlan));
  }
  if (req.feedback) {
    lines.push("", `学習者からの修正希望: ${req.feedback}`);
  }
  lines.push(
    "",
    "次の形式のJSONだけを出力してください。説明文やコードブロックは不要です。",
    '{"title": "計画名", "advice": "全体へのアドバイス（100文字以内）", "days": [{"date": "YYYY-MM-DD", "tasks": [{"subject": "科目名", "targetMinutes": 数値}]}]}',
    "・subject は対象科目の名前のみを使う",
    "・targetMinutes は5〜240の整数",
    "・1日あたりの合計が学習時間の目安に近くなるように配分する",
    "・期間内の日付だけを使う",
  );
  return lines.join("\n");
}

function sanitizePlan(raw: unknown, req: PlanRequest): GeneratedPlan {
  const r = raw as Partial<GeneratedPlan>;
  if (!r || !Array.isArray(r.days)) throw new Error("days missing");

  const byDate = new Map<string, GeneratedDay>();
  for (const day of r.days) {
    if (typeof day?.date !== "string" || !DATE_RE.test(day.date)) continue;
    if (day.date < req.startDate || day.date > req.endDate) continue;
    if (!Array.isArray(day.tasks)) continue;
    const tasks: GeneratedTask[] = [];
    for (const t of day.tasks) {
      if (!req.subjects.includes(t?.subject)) continue;
      const minutes = Math.round(Number(t.targetMinutes));
      if (!(minutes >= 5 && minutes <= 240)) continue;
      tasks.push({ subject: t.subject, targetMinutes: minutes });
      if (tasks.length >= MAX_TASKS_PER_DAY) break;
    }
    if (tasks.length > 0) byDate.set(day.date, { date: day.date, tasks });
  }

  const days = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (days.length === 0) throw new Error("no valid days");

  return {
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 50) : "学習計画",
    advice: typeof r.advice === "string" ? r.advice.slice(0, 200) : "",
    days,
  };
}

async function generateWithClaude(apiKey: string, req: PlanRequest): Promise<GeneratedPlan> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: "あなたは学習計画を作成する日本語のアシスタントです。指定された形式のJSONだけを返します。",
      messages: [{ role: "user", content: buildPrompt(req) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API responded ${response.status}`);
  }

  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON in AI response");
  return sanitizePlan(JSON.parse(match[0]), req);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const parsed = parseRequest(await req.json());
    if (typeof parsed === "string") {
      return json({ error: parsed }, 400);
    }

    const apiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) {
      return json({ plan: buildRuleBasedPlan(parsed), source: "rule" });
    }

    try {
      const plan = await generateWithClaude(apiKey, parsed);
      return json({ plan, source: "ai" });
    } catch (err) {
      console.error("AI plan generation failed, using rule-based plan:", err);
      return json({ plan: buildRuleBasedPlan(parsed), source: "rule" });
    }
  } catch (err) {
    console.error("generate-study-plan error:", err);
    return json({ error: "計画を作成できませんでした" }, 500);
  }
});
