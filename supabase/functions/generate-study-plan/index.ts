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

interface ChatMemory {
  role: string;
  content: string;
}

interface PlanRequest {
  goal: string;
  startDate: string;
  endDate: string;
  dailyMinutes: number;
  subjects: string[];
  feedback?: string;
  previousPlan?: GeneratedPlan;
  level?: string;
  weakSubjects?: string[];
  strongSubjects?: string[];
  studyStyle?: string;
  availableDays?: string[];
  restDayPattern?: string;
  priority?: string;
  notes?: string;
  memories?: ChatMemory[];
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
    level: typeof b.level === "string" ? b.level.slice(0, 100) : undefined,
    weakSubjects: Array.isArray(b.weakSubjects) ? b.weakSubjects.filter((s) => typeof s === "string") : undefined,
    strongSubjects: Array.isArray(b.strongSubjects) ? b.strongSubjects.filter((s) => typeof s === "string") : undefined,
    studyStyle: typeof b.studyStyle === "string" ? b.studyStyle.slice(0, 200) : undefined,
    availableDays: Array.isArray(b.availableDays) ? b.availableDays.filter((s) => typeof s === "string") : undefined,
    restDayPattern: typeof b.restDayPattern === "string" ? b.restDayPattern.slice(0, 100) : undefined,
    priority: typeof b.priority === "string" ? b.priority.slice(0, 200) : undefined,
    notes: typeof b.notes === "string" ? b.notes.slice(0, 500) : undefined,
    memories: Array.isArray(b.memories) ? b.memories.filter((m) => m && typeof m.role === "string" && typeof m.content === "string").slice(0, 30) : undefined,
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

function buildMemorySummary(memories?: ChatMemory[]): string {
  if (!memories || memories.length === 0) return "";
  const userMemories = memories.filter((m) => m.role === "user").slice(-15);
  const aiMemories = memories.filter((m) => m.role === "assistant").slice(-5);
  const lines: string[] = [];
  if (userMemories.length > 0) {
    lines.push("過去の会話で学習者が話したこと:");
    for (const m of userMemories) {
      lines.push(`・${m.content.slice(0, 200)}`);
    }
  }
  if (aiMemories.length > 0) {
    lines.push("過去のAIからのアドバイス:");
    for (const m of aiMemories) {
      lines.push(`・${m.content.slice(0, 150)}`);
    }
  }
  return lines.length > 0 ? "\n\n" + lines.join("\n") : "";
}

function buildPrompt(req: PlanRequest): string {
  const lines = [
    `目標: ${req.goal || "未設定"}`,
    `期間: ${req.startDate} から ${req.endDate} まで（毎日を対象とする）`,
    `1日の学習時間の目安: ${req.dailyMinutes}分`,
    `対象科目: ${req.subjects.join("、")}`,
  ];

  if (req.level) lines.push(`現在のレベル: ${req.level}`);
  if (req.weakSubjects && req.weakSubjects.length > 0) lines.push(`苦手な科目: ${req.weakSubjects.join("、")}`);
  if (req.strongSubjects && req.strongSubjects.length > 0) lines.push(`得意な科目: ${req.strongSubjects.join("、")}`);
  if (req.studyStyle) lines.push(`学習スタイル: ${req.studyStyle}`);
  if (req.availableDays && req.availableDays.length > 0) lines.push(`勉強できる曜日: ${req.availableDays.join("、")}`);
  if (req.restDayPattern) lines.push(`休みの取り方: ${req.restDayPattern}`);
  if (req.priority) lines.push(`優先したいこと: ${req.priority}`);
  if (req.notes) lines.push(`その他の要望: ${req.notes}`);

  // Memory context
  const memorySummary = buildMemorySummary(req.memories);
  if (memorySummary) {
    lines.push(memorySummary);
  }

  if (req.previousPlan) {
    lines.push("", "前回提案した計画（JSON）:", JSON.stringify(req.previousPlan));
  }
  if (req.feedback) {
    lines.push("", `学習者からの修正希望: ${req.feedback}`);
  }

  lines.push(
    "",
    "以下の点を考慮して計画を作成してください：",
    "・苦手科目には時間を多めに配分し、得意科目は効率的に進める",
    "・学習者の過去の会話メモリから、目標・得意不得意・感想・希望を踏まえて個別化する",
    "・休みの取り方や勉強できる曜日に合わせて調整する",
    "・毎日同じ配分ではなく、曜日や進捗に応じて変化を持たせる",
    "",
    "次の形式のJSONだけを出力してください。説明文やコードブロックは不要です。",
    '{"title": "計画名", "advice": "全体へのアドバイス（150文字以内・学習者の状況を踏まえた個別化的な内容）", "days": [{"date": "YYYY-MM-DD", "tasks": [{"subject": "科目名", "targetMinutes": 数値}]}]}',
    "・subject は対象科目の名前のみを使う",
    "・targetMinutes は5〜240の整数",
    "・1日あたりの合計が学習時間の目安に近くなるように配分する",
    "・期間内の日付だけを使う",
    "・休みの日や勉強できない曜日はタスクを空にするか少なめにする",
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
    // Allow days with 0 tasks (rest days)
    byDate.set(day.date, { date: day.date, tasks });
  }

  const days = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (days.length === 0) throw new Error("no valid days");

  return {
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 50) : "学習計画",
    advice: typeof r.advice === "string" ? r.advice.slice(0, 300) : "",
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
      system: "あなたは学習計画を作成する日本語のアシスタントです。学習者の過去の会話メモリや詳細な条件を踏まえて、一人ひとりに合わせた計画を作成します。指定された形式のJSONだけを返します。",
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
