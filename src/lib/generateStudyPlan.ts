import { supabase } from './supabase';

export interface GeneratedTask {
  subject: string;
  targetMinutes: number;
}

export interface GeneratedDay {
  date: string;
  tasks: GeneratedTask[];
}

export interface GeneratedPlan {
  title: string;
  advice: string;
  days: GeneratedDay[];
}

export interface ChatMemory {
  role: string;
  content: string;
}

export interface QuestionResponse {
  question: string;
  answer: string;
  score?: number;
}

export interface ChatFeedbackEntry {
  rating: string;
  request: string | null;
  messageContent: string;
  questionResponses?: QuestionResponse[] | null;
}

export interface PlanRequestInput {
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

export interface GeneratePlanResult {
  plan: GeneratedPlan;
  source: 'ai' | 'rule';
}

function isGeneratedPlan(value: unknown): value is GeneratedPlan {
  if (!value || typeof value !== 'object') return false;
  const v = value as GeneratedPlan;
  return (
    typeof v.title === 'string' &&
    typeof v.advice === 'string' &&
    Array.isArray(v.days) &&
    v.days.every(
      (d) =>
        typeof d?.date === 'string' &&
        Array.isArray(d.tasks) &&
        d.tasks.every((t) => typeof t?.subject === 'string' && typeof t?.targetMinutes === 'number'),
    )
  );
}

export async function fetchChatMemories(): Promise<ChatMemory[]> {
  const { data, error } = await supabase
    .from('chat_memories')
    .select('role, content, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return (data as { role: string; content: string; created_at: string }[])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
}

export async function fetchChatFeedback(): Promise<ChatFeedbackEntry[]> {
  const { data, error } = await supabase
    .from('chat_feedback')
    .select('rating, request, message_content, question_responses, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return (data as {
    rating: string;
    request: string | null;
    message_content: string;
    question_responses: QuestionResponse[] | null;
    created_at: string;
  }[])
    .reverse()
    .map((f) => ({
      rating: f.rating,
      request: f.request,
      messageContent: f.message_content,
      questionResponses: f.question_responses ?? null,
    }));
}

export async function generateStudyPlan(input: PlanRequestInput): Promise<GeneratePlanResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? `計画の作成に失敗しました (${response.status})`);
  }
  if (!data || !isGeneratedPlan(data.plan) || data.plan.days.length === 0) {
    throw new Error('計画の内容を読み取れませんでした');
  }
  return { plan: data.plan, source: data.source === 'ai' ? 'ai' : 'rule' };
}
