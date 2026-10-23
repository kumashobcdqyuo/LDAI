import { StudyRecord } from './types';
import { supabase } from './supabase';
import {
  streakDays,
  subjectBreakdown,
  daysSinceLastStudy,
  totalMinutes,
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

  if (gap >= 3) {
    return {
      title: 'そろそろ再開しよう',
      message: `最後に学習してから${gap}日が経ちました。少しずつでも再開してみましょう！`,
      tone: 'warn',
    };
  }

  if (streak >= 7) {
    return {
      title: 'すばらしい継続力！',
      message: `${streak}日連続で学習しています。この調子でいきましょう！`,
      tone: 'praise',
    };
  }

  if (breakdown.length > 1 && total > 0) {
    const top = breakdown[0];
    const ratio = top.minutes / total;
    if (ratio >= 0.7) {
      return {
        title: '他の科目も触れてみよう',
        message: `「${top.subject}」が学習時間の${Math.round(ratio * 100)}%を占めています。バランスよく学ぶのがおすすめです。`,
        tone: 'tip',
      };
    }
  }

  if (streak >= 3) {
    return {
      title: '調子がいいですね！',
      message: `${streak}日連続学習中。このリズムを保ち続けましょう。`,
      tone: 'praise',
    };
  }

  return {
    title: 'がんばりましょう',
    message: 'まずは短い時間でも始めてみましょう。継続が力になります！',
    tone: 'tip',
  };
}
