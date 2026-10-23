import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { StudyRecord, User, DEFAULT_SUBJECTS } from './types';

interface ProfileRow {
  id: string;
  name: string;
  avatar_color: string;
}

interface RecordRow {
  id: string;
  user_id: string;
  date: string;
  subject: string;
  minutes: number;
  memo: string;
}

export function useStudyData() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [myRecords, setMyRecords] = useState<StudyRecord[]>([]);
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const allSubjects = [...DEFAULT_SUBJECTS, ...customSubjects];

  const loadData = useCallback(async () => {
    setLoading(true);

    // Fetch all profiles, all records, and user's custom subjects
    const [profilesRes, recordsRes, subjectsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_color'),
      supabase.from('study_records').select('id, user_id, date, subject, minutes, memo'),
      user ? supabase.from('custom_subjects').select('name').eq('user_id', user.id).order('created_at') : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesRes.error) {
      console.error('Failed to load profiles:', profilesRes.error.message);
    }
    if (recordsRes.error) {
      console.error('Failed to load records:', recordsRes.error.message);
    }

    const profiles: ProfileRow[] = profilesRes.data ?? [];
    const records: RecordRow[] = recordsRes.data ?? [];
    const subjectNames: string[] = (subjectsRes.data ?? []).map((s: { name: string }) => s.name);
    setCustomSubjects(subjectNames);

    // Group records by user
    const recordsByUser = new Map<string, StudyRecord[]>();
    for (const r of records) {
      const arr = recordsByUser.get(r.user_id) ?? [];
      arr.push({
        id: r.id,
        date: r.date,
        subject: r.subject,
        minutes: r.minutes,
        memo: r.memo,
      });
      recordsByUser.set(r.user_id, arr);
    }

    const usersData: User[] = profiles.map((p) => ({
      id: p.id,
      name: p.name,
      avatarColor: p.avatar_color,
      records: recordsByUser.get(p.id) ?? [],
    }));

    setUsers(usersData);

    if (user) {
      setMyRecords(recordsByUser.get(user.id) ?? []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const addRecord = useCallback(
    async (record: Omit<StudyRecord, 'id'>): Promise<{ error: string | null }> => {
      const { data, error } = await supabase
        .from('study_records')
        .insert({
          date: record.date,
          subject: record.subject,
          minutes: record.minutes,
          memo: record.memo,
        })
        .select('id, date, subject, minutes, memo')
        .single();

      if (error) {
        return { error: error.message };
      }

      const newRecord: StudyRecord = {
        id: data.id,
        date: data.date,
        subject: data.subject,
        minutes: data.minutes,
        memo: data.memo,
      };

      setMyRecords((prev) => [...prev, newRecord]);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user?.id
            ? { ...u, records: [...u.records, newRecord] }
            : u,
        ),
      );

      return { error: null };
    },
    [user],
  );

  const addSubject = useCallback(
    async (name: string): Promise<{ error: string | null }> => {
      const trimmed = name.trim();
      if (!trimmed) return { error: '科目名を入力してください' };
      if (allSubjects.includes(trimmed)) return { error: 'その科目はすでに存在します' };

      const { error } = await supabase
        .from('custom_subjects')
        .insert({ name: trimmed });

      if (error) {
        if (error.code === '23505') return { error: 'その科目はすでに存在します' };
        return { error: error.message };
      }

      setCustomSubjects((prev) => [...prev, trimmed]);
      return { error: null };
    },
    [allSubjects],
  );

  const removeSubject = useCallback(
    async (name: string): Promise<{ error: string | null }> => {
      if (DEFAULT_SUBJECTS.includes(name as typeof DEFAULT_SUBJECTS[number])) {
        return { error: 'デフォルトの科目は削除できません' };
      }

      const { error } = await supabase
        .from('custom_subjects')
        .delete()
        .eq('name', name);

      if (error) return { error: error.message };

      setCustomSubjects((prev) => prev.filter((s) => s !== name));
      return { error: null };
    },
    [],
  );

  return { users, myRecords, loading, addRecord, reload: loadData, allSubjects, addSubject, removeSubject };
}
