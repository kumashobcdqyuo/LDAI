const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StudyRecordInput {
  date: string;
  subject: string;
  minutes: number;
  memo: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { records, userName } = await req.json() as {
      records: StudyRecordInput[];
      userName?: string;
    };

    if (!Array.isArray(records)) {
      return new Response(
        JSON.stringify({ error: "records must be an array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // If no CLAUDE_API_KEY is configured, fall back to rule-based advice
    const claudeKey = Deno.env.get("CLAUDE_API_KEY");

    if (!claudeKey) {
      // Rule-based fallback (same logic as the frontend version)
      const advice = getRuleBasedAdvice(records);
      return new Response(
        JSON.stringify(advice),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build a summary of the records for Claude
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

    const systemPrompt = `あなたは学習サポートのアドバイザーです。学習データをもとに、簡潔で励みになるアドバイスを日本語で提供してください。
以下のJSON形式で返答してください：
{"title": "タイトル（15文字以内）", "message": "メッセージ（80文字以内）", "tone": "praise" | "warn" | "tip"}
- praise: 称賛・励まし
- warn: 注意喚起
- tip: アドバイス・提案`;

    const userPrompt = `学習者: ${userName ?? "学習者"}
直近2週間の学習データ:
- 合計学習時間: ${totalMinutes}分
- 科目別: ${subjectSummary}
- 連続学習日数: ${streak}日
- 最終学習からの経過日数: ${gap}日
- 学習日数: ${studiedDates.size}日 / 14日

このデータを踏まえて、学習継続のためのアドバイスを一つ提案してください。`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          { role: "user", content: userPrompt },
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      const fallback = getRuleBasedAdvice(records);
      return new Response(
        JSON.stringify(fallback),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const claudeData = await response.json();
    const text = claudeData?.content?.[0]?.text ?? "";

    // Parse JSON from Claude's response
    let advice;
    try {
      // Extract JSON from the text (in case there's surrounding text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      advice = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      advice = null;
    }

    if (!advice || !advice.title || !advice.message || !advice.tone) {
      advice = getRuleBasedAdvice(records);
    }

    return new Response(
      JSON.stringify(advice),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Edge function error:", err);
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

function getRuleBasedAdvice(records: StudyRecordInput[]) {
  const studiedDates = new Set(records.map((r) => r.date));
  const total = records.reduce((s, r) => s + r.minutes, 0);
  const gap = calculateGap(studiedDates);
  const streak = calculateStudiedDays(studiedDates);

  const subjectMap = new Map<string, number>();
  for (const r of records) {
    subjectMap.set(r.subject, (subjectMap.get(r.subject) ?? 0) + r.minutes);
  }
  const breakdown = Array.from(subjectMap.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  if (gap >= 3) {
    return {
      title: "そろそろ再開しよう",
      message: `最後に学習してから${gap}日が経ちました。少しずつでも再開してみましょう！`,
      tone: "warn",
    };
  }

  if (streak >= 7) {
    return {
      title: "すばらしい継続力！",
      message: `${streak}日連続で学習しています。この調子でいきましょう！`,
      tone: "praise",
    };
  }

  if (breakdown.length > 1 && total > 0) {
    const top = breakdown[0];
    const ratio = top[1] / total;
    if (ratio >= 0.7) {
      return {
        title: "他の科目も触れてみよう",
        message: `「${top[0]}」が学習時間の${Math.round(ratio * 100)}%を占めています。バランスよく学ぶのがおすすめです。`,
        tone: "tip",
      };
    }
  }

  if (streak >= 3) {
    return {
      title: "調子がいいですね！",
      message: `${streak}日連続学習中。このリズムを保ち続けましょう。`,
      tone: "praise",
    };
  }

  return {
    title: "がんばりましょう",
    message: "まずは短い時間でも始めてみましょう。継続が力になります！",
    tone: "tip",
  };
}
