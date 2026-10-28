import { StudyRecord } from './types';
import { supabase } from './supabase';
import {
  streakDays,
  subjectBreakdown,
  daysSinceLastStudy,
  totalMinutes,
  minutesThisWeek,
  minutesLastWeek,
} from './stats';

export interface AdviceResult {
  title: string;
  message: string;
  tone: 'praise' | 'warn' | 'tip';
}

/**
 * Fetches AI advice from the Supabase Edge Function.
 * The edge function calls Claude API (if CLAUDE_API_KEY is configured)
 * or falls back to rule-based advice.
 *
 * Only the last 2 weeks of records are sent to minimize payload.
 */
export async function getAdvice(
  records: StudyRecord[],
  userName?: string,
): Promise<AdviceResult> {
  // Filter to last 14 days
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const cutoff = twoWeeksAgo.toISOString().slice(0, 10);
  const recentRecords = records.filter((r) => r.date >= cutoff);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-advice`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        records: recentRecords.map((r) => ({
          date: r.date,
          subject: r.subject,
          minutes: r.minutes,
          memo: r.memo,
        })),
        userName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Advice request failed (${response.status})`);
    }

    const data = await response.json();
    if (!data.title || !data.message || !data.tone) {
      throw new Error('Invalid advice response');
    }

    return {
      title: data.title,
      message: data.message,
      tone: data.tone,
    };
  } catch (err) {
    console.error('getAdvice: falling back to local rules:', err);
    return getLocalAdvice(records);
  }
}

function getLocalAdvice(records: StudyRecord[]): AdviceResult {
  const streak = streakDays(records);
  const breakdown = subjectBreakdown(records);
  const total = totalMinutes(records);
  const gap = daysSinceLastStudy(records);
  const thisWeek = minutesThisWeek(records);
  const lastWeek = minutesLastWeek(records);
  const diff = thisWeek - lastWeek;

  if (gap >= 3) {
    return {
      title: 'そろそろ再開しよう',
      message: `最後に学習してから${gap}日が経ちました。今日15分だけでも進めてみませんか？`,
      tone: 'warn',
    };
  }

  if (streak >= 7) {
    return {
      title: `${streak}日連続学習中！`,
      message: `素晴らしい継続力です。今週は${thisWeek}分学習済み。このペースを保っていきましょう！`,
      tone: 'praise',
    };
  }

  if (breakdown.length > 1 && total > 0) {
    const top = breakdown[0];
    const ratio = top.minutes / total;
    if (ratio >= 0.7) {
      const second = breakdown[1];
      return {
        title: `${top.subject}に偏り気味`,
        message: `${top.subject}が学習時間の${Math.round(ratio * 100)}%を占めています。${second ? `${second.subject}も` : '他の科目も'}少しずつ進めるとバランスが良くなります。`,
        tone: 'tip',
      };
    }
  }

  if (streak >= 3) {
    return {
      title: `${streak}日連続達成！`,
      message: `今週は${thisWeek}分学習しています。${diff < 0 ? `先週より${Math.abs(diff)}分少ないので、今日少し追加してみませんか？` : diff > 0 ? `先週より${diff}分多く学習できています！` : '先週と同じペースです。このリズムを保ちましょう！'}`,
      tone: 'praise',
    };
  }

  if (thisWeek > 0 && diff !== 0) {
    return {
      title: diff < 0 ? '今週は少し少なめ' : '今週は好調！',
      message: `今週は${thisWeek}分学習。${diff < 0 ? `先週より${Math.abs(diff)}分少ないので、今日${Math.min(15, Math.abs(diff))}分だけ進めてみませんか？` : `先週より${diff}分多く学習できています。この調子で！`}`,
      tone: diff < 0 ? 'warn' : 'praise',
    };
  }

  if (total > 0) {
    return {
      title: 'もう一歩踏み出そう',
      message: `今月はこれまで${total}分学習しています。今日短い時間でも記録をつけて、流れを作りましょう！`,
      tone: 'tip',
    };
  }

  return {
    title: '最初の一歩を記録しよう',
    message: 'まだ学習記録がありません。まずは15分だけでも記録をつけて、継続の第一歩を始めましょう！',
    tone: 'tip',
  };
}
