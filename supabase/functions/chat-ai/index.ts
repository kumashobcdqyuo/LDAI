const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface StudyRecordInput {
  date: string;
  subject: string;
  minutes: number;
  memo: string;
}

interface PlanTaskInput {
  subject: string;
  targetMinutes: number;
  done: boolean;
}

interface PlanInput {
  title: string;
  goal: string | null;
  startDate: string;
  endDate: string | null;
  tasks: PlanTaskInput[];
}

interface MemoryInput {
  role: string;
  content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, records, userName, plans, memories } = await req.json() as {
      messages: ChatMessage[];
      records?: StudyRecordInput[];
      userName?: string;
      plans?: PlanInput[];
      memories?: MemoryInput[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages must be a non-empty array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const claudeKey = Deno.env.get("CLAUDE_API_KEY");

    // Build study context summary
    let contextSummary = "学習データがまだありません。";
    if (records && records.length > 0) {
      const totalMinutes = records.reduce((s, r) => s + r.minutes, 0);
      const subjectMap = new Map<string, number>();
      for (const r of records) {
        subjectMap.set(r.subject, (subjectMap.get(r.subject) ?? 0) + r.minutes);
      }
      const subjectSummary = Array.from(subjectMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([s, m]) => `${s}: ${m}分`)
        .join(", ");
      const studiedDates = new Set(records.map((r) => r.date));
      const streak = calculateStudiedDays(studiedDates);
      const gap = calculateGap(studiedDates);

      const recentMemos = records
        .slice(-5)
        .map((r) => `${r.date} ${r.subject} ${r.minutes}分「${r.memo}」`)
        .join("\n");

      contextSummary = `学習者: ${userName ?? "学習者"}
直近2週間の学習データ:
- 合計学習時間: ${totalMinutes}分
- 科目別: ${subjectSummary}
- 連続学習日数: ${streak}日
- 最終学習からの経過日数: ${gap}日
- 学習日数: ${studiedDates.size}日 / 14日
- 直近のメモ:
${recentMemos}`;
    }

    // Build memory summary from past conversations
    let memorySummary = "";
    if (memories && memories.length > 0) {
      const recentMemories = memories.slice(-20);
      memorySummary = "\n\n過去の会話メモリ（直近のやり取り）:\n" +
        recentMemories
          .map((m) => `${m.role === "user" ? "学習者" : "AI"}: ${m.content.slice(0, 200)}`)
          .join("\n");
    }

    const systemPrompt = `あなたは学習サポートのAIアドバイザーです。学習者のデータをもとに、親身で励みになるアドバイスを日本語で提供します。

以下の学習データを参考にしながら、ユーザーの質問や相談に答えてください。

${contextSummary}
${buildPlanSummary(plans)}${memorySummary}

あなたは以下の役割をすべて担います：

1. 学習計画の相談
   - 勉強スケジュールの作成、科目の優先順位、時間配分の提案
   - 学習者の目標や状況を詳しく聞き出すために、追加の質問を積極的に行う
   - 一度の回答で完成させるのではなく、目標・期限・現在のレベル・1日に使える時間・得意不得意などを質問してから、それに合わせた計画を提案する
   - 計画を作成する際は、過去の会話メモリから学習者の状況や希望を踏まえて提案する

2. 学習データの分析とアドバイス
   - 学習ペース、科目バランス、継続状況の分析と改善提案

3. モチベーション維持のサポート
   - 継続のコツ、挫折しそうな時の対処法

4. 問題の解答・解説
   - ユーザーが問題文を送ってきた場合、答えだけでなく解説も丁寧に行う
   - 数学、英語、国語、理科、社会、プログラミングなど幅広い科目に対応
   - 解答の手順を段階的に説明し、なぜその答えになるかを分かりやすく解説する
   - 間違えやすいポイントや類題への応用も併せて提示する

5. 学習方法のアドバイス
   - 科目ごとの効果的な学習法、暗記のコツ、問題の解き方

回答のポイント:
- ユーザーの質問内容に直接答える
- 学習データと過去の会話メモリを踏まえた具体的なアドバイスをする
- 計画の相談では、情報が足りない場合は必ず追加質問をしてから提案する
- 分かりやすい日本語で、必要に応じて箇条書きや段階的な説明を使う
- 簡潔すぎず、十分な説明を含める（最大800文字）
- 問題の解答・解説を求められた場合は、丁寧なステップ解説を心がける
- 励ましと具体的な提案を含める
- 過去の会話で学習者が話した希望や状況を覚えており、それを踏まえて回答する`;

    if (!claudeKey) {
      // Fallback: rule-based responses when no API key
      const lastUserMsg = messages[messages.length - 1]?.content ?? "";
      const fallback = getFallbackResponse(lastUserMsg, records ?? [], plans ?? [], memories ?? []);
      return new Response(
        JSON.stringify({ reply: fallback }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Convert messages for Claude API
    const claudeMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      const fallback = getFallbackResponse(
        messages[messages.length - 1]?.content ?? "",
        records ?? [],
        plans ?? [],
        memories ?? [],
      );
      return new Response(
        JSON.stringify({ reply: fallback }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const claudeData = await response.json();
    const reply = claudeData?.content?.[0]?.text ?? "すみません、回答できませんでした。";

    return new Response(
      JSON.stringify({ reply }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Chat edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function calculateStudiedDays(studiedDates: Set<string>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const cursor = new Date(today);
  const todayStr = dateToStr(cursor);
  if (!studiedDates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!studiedDates.has(dateToStr(cursor))) return 0;
  }
  while (studiedDates.has(dateToStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calculateGap(studiedDates: Set<string>): number {
  if (studiedDates.size === 0) return 999;
  const sorted = Array.from(studiedDates).sort().reverse();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(sorted[0]);
  last.setHours(0, 0, 0, 0);
  return Math.round(
    (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildPlanSummary(plans?: PlanInput[]): string {
  if (!plans || plans.length === 0) {
    return "";
  }

  const lines: string[] = ["", "学習計画:"];

  for (const p of plans) {
    const done = p.tasks.filter((t) => t.done).length;
    const total = p.tasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const taskList = p.tasks.length > 0
      ? p.tasks.map((t) => `  ・${t.subject} ${t.targetMinutes}分 [${t.done ? "完了" : "未完了"}]`).join("\n")
      : "  （タスクなし）";

    lines.push(
      `【${p.title}】${pct}%完了 (${done}/${total})`,
      `  目標: ${p.goal ?? "未設定"}`,
      `  期間: ${p.startDate}〜${p.endDate ?? "未定"}`,
      `  タスク:`,
      taskList,
    );
  }

  return lines.join("\n");
}

function getFallbackResponse(
  userMessage: string,
  records: StudyRecordInput[],
  plans: PlanInput[] = [],
  memories: MemoryInput[] = [],
): string {
  const msg = userMessage.trim();
  const lower = msg.toLowerCase();
  const hasRecords = records.length > 0;
  const hasPlans = plans.length > 0;
  const hasMemories = memories.length > 0;

  // Detect a problem/question being submitted — look for math expressions, question marks, or problem-like patterns
  if (/\d+\s*[+\-*/×÷]\s*\d+/.test(msg) || /計算|解いて|答え|解説|問題/.test(msg)) {
    return solveProblemFallback(msg);
  }

  // English translation / grammar
  if (/英訳|英文|和訳|英単語|英語の|translate|english/i.test(msg)) {
    return "英語に関するご質問ですね。申し訳ありませんが、現在AIの応答システムが制限モードで動作しています。\n\n翻訳や文法の解説など、より詳細な回答を行うには、AI機能の有効化が必要です。それでも基本的なことならお手伝いできるので、具体的な英文や質問をもう少し詳しく教えてください！";
  }

  // Study schedule / plan — ask follow-up questions for better planning
  if (/計画|スケジュール|計画表|いつ|何時間|どのくらい|時間配分|進捗|進ちょく/.test(msg)) {
    let memoryHint = "";
    if (hasMemories) {
      const userMemories = memories.filter((m) => m.role === "user").slice(-5);
      if (userMemories.length > 0) {
        memoryHint = "\n\n以前の会話で以下のことをお聞きしました：\n" +
          userMemories.map((m) => `・${m.content.slice(0, 80)}`).join("\n") +
          "\nこれを踏まえて提案します。";
      }
    }

    if (hasPlans) {
      const planSummaries = plans.map((p) => {
        const done = p.tasks.filter((t) => t.done).length;
        const total = p.tasks.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const taskList = p.tasks.map((t) => `  ・${t.subject} ${t.targetMinutes}分 [${t.done ? "完了" : "未完了"}]`).join("\n");
        return `【${p.title}】${pct}%完了 (${done}/${total})\n目標: ${p.goal ?? "未設定"}\n期間: ${p.startDate}〜${p.endDate ?? "未定"}\nタスク:\n${taskList}`;
      }).join("\n\n");
      return `学習計画についてですね！${memoryHint}\n\n現在の計画状況は以下の通りです：\n\n${planSummaries}\n\n${hasRecords ? "直近2週間の学習記録と照らし合わせて、計画の進捗を確認できます。" : "学習記録を追加すると、計画と実際の学習のギャップも確認できます。"}\n\nより精度の高い計画を立てるために、以下を教えてください：\n1. テストや目標の期限はいつですか？\n2. 1日にどれくらい勉強できそうですか？\n3. 特に得意な科目・苦手な科目はありますか？\n\nこれらに答えていただければ、より良い計画をご提案できます！`;
    }
    if (hasRecords) {
      const total = records.reduce((s, r) => s + r.minutes, 0);
      const subjectMap = new Map<string, number>();
      for (const r of records) {
        subjectMap.set(r.subject, (subjectMap.get(r.subject) ?? 0) + r.minutes);
      }
      const subjects = Array.from(subjectMap.entries()).sort((a, b) => b[1] - a[1]);
      const topSubject = subjects[0]?.[0] ?? "";
      return `学習計画のご相談ですね！${memoryHint}\n\n直近2週間のデータを見ると、合計${total}分学習しています。最も多く学習している科目は「${topSubject}」です。\n\nより良い計画を立てるために、いくつか質問させてください：\n1. 目標は何ですか？（テスト、資格、趣味など）\n2. 期限はいつですか？\n3. 1日にどれくらい時間を取れそうですか？\n4. 得意・苦手な科目を教えてください\n\nこれらに答えていただければ、あなたに合わせた計画をご提案します！`;
    }
    return `学習計画のご相談ですね！${memoryHint}\n\nより良い計画をご提案するために、以下を教えてください：\n1. 目標は何ですか？（例: テストで80点以上、資格試験合格など）\n2. 期限はいつですか？\n3. 1日にどれくらい勉強できそうですか？\n4. 取り組みたい科目は何ですか？\n5. 特に得意・苦手な科目はありますか？\n\nこれらに答えていただければ、あなたに合わせた学習計画をご提案します！`;
  }

  // Motivation
  if (/モチベ|やる気|続け|だる|疲れ|挫折|辛い|つらい/.test(msg)) {
    return "学習を続けるのは大変ですよね。その気持ち、よく分かります。\n\nモチベーションを保つコツ：\n1. 小さな目標を立てて達成感を味わう\n2. 学習記録をつけて成長を可視化する\n3. ご褒美を用意する\n4. 仲間と一緒に学ぶ\n\n今のあなたでも、このアプリで記録をつけている時点で立派な第一歩です！";
  }

  // Subject balance
  if (/科目|バランス|バラツキ|偏り/.test(msg)) {
    if (!hasRecords) return "学習記録を追加すると、科目ごとのバランスについてアドバイスできます！";
    const subjectMap = new Map<string, number>();
    for (const r of records) {
      subjectMap.set(r.subject, (subjectMap.get(r.subject) ?? 0) + r.minutes);
    }
    const subjects = Array.from(subjectMap.entries()).sort((a, b) => b[1] - a[1]);
    const breakdown = subjects.map(([s, m]) => `・${s}: ${m}分`).join("\n");
    return `科目別の学習時間は以下の通りです：\n\n${breakdown}\n\nバランスを整えるポイント：\n・一番多い科目と少ない科目の差が大きい場合、少ない科目に少し時間を増やしてみましょう\n・得意科目だけでなく、苦手科目にも計画的に取り組むのが重要です`;
  }

  // Study pace
  if (/ペース|頻度|どれくらい|どのくらい|足りない|多い|少ない/.test(msg)) {
    if (!hasRecords) return "学習記録を追加すると、学習ペースについてのアドバイスができます！";
    const total = records.reduce((s, r) => s + r.minutes, 0);
    const studiedDates = new Set(records.map((r) => r.date));
    const avgPerDay = Math.round(total / 14);
    return `直近2週間の学習データ：\n・合計: ${total}分\n・学習日数: ${studiedDates.size}日 / 14日\n・1日平均: ${avgPerDay}分\n\n一般的には1日30分以上の学習で継続効果が高まります。今のペースを維持しつつ、無理のない範囲で少しずつ増やしていくのがおすすめです！`;
  }

  // Study methods
  if (/勉強法|学習法|覚え|暗記|やり方|効率/.test(msg)) {
    return "効果的な学習方法についてですね！\n\nおすすめの学習法：\n1. アクティブリコール（思い出す練習）\n2. 分散学習（間隔を空けて復習）\n3. ポモドーロ技法（25分学習＋5分休憩）\n4. 人に教える（アウトプットで定着）\n\nAI機能を有効化すると、あなたの学習データに合わせて個別の学習法提案が受けられます。";
  }

  // Greeting
  if (/こんにちは|こんばんは|おはよう|はじめまして|hello|hi/i.test(lower)) {
    return "こんにちは！学習に関する相談なら何でも聞いてください。\n\nできること：\n・学習計画の相談\n・科目バランスの分析\n・モチベーション維持のコツ\n・問題の解答・解説\n・効果的な学習方法\n\nお気軽に質問してください！";
  }

  // Default: try to give a meaningful response based on content
  if (msg.length > 0) {
    return `ご質問ありがとうございます。「${msg.slice(0, 50)}${msg.length > 50 ? "..." : ""}」についてですね。\n\n現在、AIの応答システムが制限モードで動作しているため、詳細な回答ができない場合があります。学習の進め方、科目バランス、モチベーション、学習計画などの基本的な相談にはお答えできます。\n\nAI機能を有効化すると、問題の解答・解説など、より幅広い質問に丁寧にお答えできるようになります。`;
  }

  return "学習に関する相談なら何でも聞いてください！勉強の進め方、科目のバランス、モチベーションの維持、問題の解答・解説など、お気軽にどうぞ。";
}

function solveProblemFallback(msg: string): string {
  // Try to evaluate simple arithmetic
  const arithmeticMatch = msg.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(-?\d+(?:\.\d+)?)/);
  if (arithmeticMatch) {
    const a = parseFloat(arithmeticMatch[1]);
    const op = arithmeticMatch[2];
    const b = parseFloat(arithmeticMatch[3]);
    let result: number | null = null;
    let opName = "";

    switch (op) {
      case "+":
        result = a + b;
        opName = "足し算";
        break;
      case "-":
        result = a - b;
        opName = "引き算";
        break;
      case "*":
      case "×":
        result = a * b;
        opName = "掛け算";
        break;
      case "/":
      case "÷":
        if (b !== 0) {
          result = a / b;
          opName = "割り算";
        }
        break;
    }

    if (result !== null) {
      const steps = formatArithmeticSteps(a, op, b, result);
      return `${opName}の問題ですね！\n\n【答え】${result}\n\n【解説】\n${steps}\n\n他にも解きたい問題があれば送ってください！`;
    }
  }

  return `問題を解きたいのですね！申し訳ありませんが、現在AIの応答システムが制限モードで動作しています。\n\n簡単な四則演算ならお答えできます（例：「12 × 8」や「100 ÷ 4」）。\n\nより複雑な問題の解答・解説を行うには、AI機能の有効化が必要です。有効化すると、数学の応用問題や英語の翻訳、国語の文法など、幅広い問題にステップ解説付きで回答できるようになります。`;
}

function formatArithmeticSteps(a: number, op: string, b: number, result: number): string {
  const opSymbol = op === "*" ? "×" : op === "/" ? "÷" : op;
  return `${a} ${opSymbol} ${b} を計算します。\n① ${a} と ${b} を ${opSymbol} で計算\n② 結果: ${result}\n\n確認: ${a} ${opSymbol} ${b} = ${result}`;
}
