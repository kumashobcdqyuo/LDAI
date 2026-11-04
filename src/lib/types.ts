export interface StudyRecord {
  id: string;
  date: string; // YYYY-MM-DD
  subject: string;
  minutes: number;
  memo: string;
}

export interface User {
  id: string;
  name: string;
  avatarColor: string;
  records: StudyRecord[];
}

export const DEFAULT_SUBJECTS = [
  '数学',
  '英語',
  '国語',
  '理科',
  '社会',
  'プログラミング',
] as const;

export interface StudyPlanTask {
  id: string;
  subject: string;
  targetMinutes: number;
  done: boolean;
  scheduledDate: string | null; // YYYY-MM-DD, null when not placed on the calendar
}

export interface StudyPlan {
  id: string;
  title: string;
  goal: string | null;
  startDate: string;
  endDate: string | null;
  tasks: StudyPlanTask[];
}
