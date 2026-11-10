const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_DAYS = 90;
const MAX_TASKS_PER_DAY = 8;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_MAP: Record<string, number> = { "月": 1, "火": 2, "水": 3, "木": 4, "金": 5, "土": 6, "日": 0 };

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

interface ChatFeedbackEntry {
  rating: string;
  request: string | null;
  messageContent: string;
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
  feedbackMemories?: ChatFeedbackEntry[];
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

function getWeekday(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.getUTCDay();
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
    feedbackMemories: Array.isArray(b.feedbackMemories) ? b.feedbackMemories.filter((f) => f && typeof f.rating === "string" && typeof f.messageContent === "string").slice(0, 20) : undefined,
  };
}

function buildSubjectWeights(req: PlanRequest): Map<string, number> {
  const weights = new Map<string, number>();
  for (const s of req.subjects) weights.set(s, 1.0);

  if (req.weakSubjects) {
    for (const s of req.weakSubjects) {
      if (weights.has(s)) weights.set(s, 1.6);
    }
  }
  if (req.strongSubjects) {
    for (const s of req.strongSubjects) {
      if (weights.has(s)) {
        const current = weights.get(s) ?? 1.0;
        weights.set(s, Math.max(0.5, current - 0.4));
      }
    }
  }

  if (req.priority) {
    for (const s of req.subjects) {
      if (req.priority.includes(s)) {
        weights.set(s, (weights.get(s) ?? 1.0) + 0.4);
      }
    }
  }

  return weights;
}

function isRestDay(dateStr: string, req: PlanRequest): boolean {
  const wd = getWeekday(dateStr);
  const wdName = Object.entries(WEEKDAY_MAP).find(([, v]) => v === wd)?.[0];

  if (req.availableDays && req.availableDays.length > 0 && wdName) {
    if (!req.availableDays.includes(wdName)) return true;
  }

  if (req.restDayPattern) {
    const pattern = req.restDayPattern;
    if (wd === 0 && (pattern.includes("日曜") || pattern.includes("日"))) {
      if (pattern.includes("完全休") || pattern.includes("休み") || pattern.includes("休業")) return true;
    }
    if (wd === 6 && pattern.includes("土曜")) {
      if (pattern.includes("完全休") || pattern.includes("休み") || pattern.includes("休業")) return true;
    }
  }

  return false;
}

function getDayMultiplier(dateStr: string, req: PlanRequest): number {
  if (isRestDay(dateStr, req)) return 0;

  if (req.restDayPattern) {
    const wd = getWeekday(dateStr);
    const pattern = req.restDayPattern;
    if (wd === 6 && pattern.includes("土曜") && pattern.includes("半")) return 0.5;
    if (wd === 0 && pattern.includes("日曜") && pattern.includes("半")) return 0.5;
  }

  return 1.0;
}

function buildRuleBasedPlan(req: PlanRequest): GeneratedPlan {
  const weights = buildSubjectWeights(req);
  const totalWeight = req.subjects.reduce((sum, s) => sum + (weights.get(s) ?? 1.0), 0);

  const days: GeneratedDay[] = [];
  const count = dayCount(req.startDate, req.endDate);

  const feedbackLower = (req.feedback ?? "").toLowerCase();
  const increaseWeekend = feedbackLower.includes("週末") || feedbackLower.includes("土日") || feedbackLower.includes("増や");
  const decreaseWeekday = feedbackLower.includes("平日") && (feedbackLower.includes("減") || feedbackLower.includes("少な"));

  const adviceParts: string[] = [];

  if (req.weakSubjects && req.weakSubjects.length > 0) {
    adviceParts.push(`苦手科目（${req.weakSubjects.join("、")}）の時間を多めに配分しました。`);
  }
  if (req.strongSubjects && req.strongSubjects.length > 0) {
    adviceParts.push(`得意科目（${req.strongSubjects.join("、")}）は効率的に進められるよう時間を抑えています。`);
  }
  if (req.availableDays && req.availableDays.length > 0) {
    adviceParts.push(`勉強できる曜日（${req.availableDays.join("、")}）に合わせて配分しています。`);
  }
  if (req.restDayPattern) {
    adviceParts.push(`休みの取り方（${req.restDayPattern}）を反映しました。`);
  }
  if (req.priority) {
    adviceParts.push(`優先事項「${req.priority}」を考慮しました。`);
  }
  if (req.notes) {
    adviceParts.push(`ご要望「${req.notes}」を踏まえています。`);
  }
  if (req.feedback) {
    adviceParts.push(`修正希望「${req.feedback}」を反映して作り直しました。`);
  }
  if (req.memories && req.memories.filter((m) => m.role === "user").length > 0) {
    adviceParts.push(`過去のチャットでの発言から学習状況を参照しました。`);
  }
  if (req.feedbackMemories && req.feedbackMemories.length > 0) {
    const badCount = req.feedbackMemories.filter((f) => f.rating === "bad").length;
    const goodCount = req.feedbackMemories.filter((f) => f.rating === "good").length;
    if (badCount > 0 || goodCount > 0) {
      adviceParts.push(`過去のチャットフィードバック（良い${goodCount}件・改善希望${badCount}件）を反映しました。`);
    }
  }

  const baseAdvice = adviceParts.length > 0
    ? adviceParts.join(" ")
    : "1日の目標時間を科目ごとに配分しました。進み具合に合わせて調整してください。";

  for (let i = 0; i < count; i++) {
    const date = shiftDate(req.startDate, i);
    const dayMult = getDayMultiplier(date, req);

    if (dayMult === 0) {
      days.push({ date, tasks: [] });
      continue;
    }

    let dayMinutes = req.dailyMinutes * dayMult;

    const wd = getWeekday(date);
    if (increaseWeekend && (wd === 0 || wd === 6)) {
      dayMinutes = Math.min(600, Math.round(dayMinutes * 1.5));
    }
    if (decreaseWeekday && wd >= 1 && wd <= 5) {
      dayMinutes = Math.max(15, Math.round(dayMinutes * 0.7));
    }

    dayMinutes = Math.round(dayMinutes / 5) * 5;

    const tasks: GeneratedTask[] = [];
    let allocated = 0;
    for (const subject of req.subjects) {
      const w = weights.get(subject) ?? 1.0;
      const minutes = Math.max(5, Math.round((dayMinutes * w / totalWeight) / 5) * 5);
      tasks.push({ subject, targetMinutes: minutes });
      allocated += minutes;
    }

    if (tasks.length > 0) {
      const diff = dayMinutes - allocated;
      if (diff !== 0) {
        const lastIdx = tasks.length - 1;
        const adjusted = Math.max(5, tasks[lastIdx].targetMinutes + diff);
        tasks[lastIdx] = { ...tasks[lastIdx], targetMinutes: Math.min(240, adjusted) };
      }
    }

    days.push({ date, tasks: tasks.slice(0, MAX_TASKS_PER_DAY) });
  }

  const titleParts: string[] = [];
  if (req.goal) titleParts.push(req.goal);
  else titleParts.push("学習計画");
  if (req.level) titleParts.push(`(${req.level})`);

  return {
    title: titleParts.join(" "),
    advice: baseAdvice.slice(0, 300),
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

  const memorySummary = buildMemorySummary(req.memories);
  if (memorySummary) {
    lines.push(memorySummary);
  }

  if (req.feedbackMemories && req.feedbackMemories.length > 0) {
    lines.push("", "過去のチャットフィードバック:");
    for (const f of req.feedbackMemories.slice(-10)) {
      const ratingText = f.rating === "good" ? "良い評価" : "改善希望";
      const requestText = f.request ? `（要望: ${f.request.slice(0, 150)}）` : "";
      lines.push(`・[${ratingText}] ${f.messageContent.slice(0, 100)}${requestText}`);
    }
  }

  if (req.previousPlan) {
    lines.push("", "前回提案した計画（JSON）:", JSON.stringify(req.previousPlan));
  }
  if (req.feedback) {
    lines.push("", `学習者からの修正希望: ${req.feedback}`);
  }

  lines.push(
    "",
    "以下の点を必ず守って計画を作成してください：",
    "・苦手科目には時間を多めに（1.5倍程度）配分し、得意科目は少なめにする",
    "・学習者の過去の会話メモリから、目標・得意不得意・感想・希望を抽出し、計画に反映する",
    "・休みの取り方や勉強できない曜日はタスクを空にするか時間を減らす",
    "・優先したいことにある科目は時間を多めにする",
    "・その他の要望は計画の配分や構成に必ず反映する",
    "・修正希望がある場合は、前回の計画と比較して必ず変更を加える",
    "・毎日同じ配分ではなく、曜日や進捗に応じて変化を持たせる",
    "・adviceには学習者の詳細条件やメモリを踏まえた個別的な内容を書く",
    "",
    "次の形式のJSONだけを出力してください。説明文やコードブロックは不要です。",
    '{"title": "計画名", "advice": "全体へのアドバイス（150文字以内・詳細条件とメモリを踏まえた個別的な内容）", "days": [{"date": "YYYY-MM-DD", "tasks": [{"subject": "科目名", "targetMinutes": 数値}]}]}',
    "・subject は対象科目の名前のみを使う",
    "・targetMinutes は5〜240の整数",
    "・1日あたりの合計が学習時間の目安に近くなるように配分する",
    "・期間内の日付だけを使う",
    "・休みの日や勉強できない曜日はタスクを空にする（tasks: []）",
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
      system: "あなたは学習計画を作成する日本語のアシスタントです。学習者の過去の会話メモリ、詳細な条件、修正希望をすべて踏まえて、一人ひとりに合わせた計画を作成します。指定された形式のJSONだけを返します。",
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
