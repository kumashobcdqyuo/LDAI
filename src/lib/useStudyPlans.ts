import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { StudyPlan, StudyPlanTask } from './types';

interface PlanRow {
  id: string;
  title: string;
  goal: string | null;
  start_date: string;
  end_date: string | null;
}

interface TaskRow {
  id: string;
  plan_id: string;
  subject: string;
  target_minutes: number;
  done: boolean;
}

export function useStudyPlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    if (!user) {
      setPlans([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [plansRes, tasksRes] = await Promise.all([
      supabase.from('study_plans').select('id, title, goal, start_date, end_date').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('study_plan_tasks').select('id, plan_id, subject, target_minutes, done').order('created_at', { ascending: true }),
    ]);

    if (plansRes.error) {
      console.error('Failed to load plans:', plansRes.error.message);
    }
    if (tasksRes.error) {
      console.error('Failed to load plan tasks:', tasksRes.error.message);
    }

    const planRows: PlanRow[] = plansRes.data ?? [];
    const taskRows: TaskRow[] = tasksRes.data ?? [];

    const tasksByPlan = new Map<string, StudyPlanTask[]>();
    for (const t of taskRows) {
      const arr = tasksByPlan.get(t.plan_id) ?? [];
      arr.push({
        id: t.id,
        subject: t.subject,
        targetMinutes: t.target_minutes,
        done: t.done,
      });
      tasksByPlan.set(t.plan_id, arr);
    }

    const plansData: StudyPlan[] = planRows.map((p) => ({
      id: p.id,
      title: p.title,
      goal: p.goal,
      startDate: p.start_date,
      endDate: p.end_date,
      tasks: tasksByPlan.get(p.id) ?? [],
    }));

    setPlans(plansData);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const createPlan = useCallback(
    async (plan: {
      title: string;
      goal?: string;
      startDate: string;
      endDate?: string;
      tasks: { subject: string; targetMinutes: number }[];
    }): Promise<{ error: string | null; plan?: StudyPlan }> => {
      const { data, error } = await supabase
        .from('study_plans')
        .insert({
          title: plan.title,
          goal: plan.goal || null,
          start_date: plan.startDate,
          end_date: plan.endDate || null,
        })
        .select('id, title, goal, start_date, end_date')
        .single();

      if (error) return { error: error.message };

      const planRow = data as PlanRow;
      const newPlan: StudyPlan = {
        id: planRow.id,
        title: planRow.title,
        goal: planRow.goal,
        startDate: planRow.start_date,
        endDate: planRow.end_date,
        tasks: [],
      };

      if (plan.tasks.length > 0) {
        const { data: taskData, error: taskError } = await supabase
          .from('study_plan_tasks')
          .insert(
            plan.tasks.map((t) => ({
              plan_id: planRow.id,
              subject: t.subject,
              target_minutes: t.targetMinutes,
            })),
          )
          .select('id, subject, target_minutes, done');

        if (taskError) return { error: taskError.message };

        newPlan.tasks = (taskData as TaskRow[]).map((t) => ({
          id: t.id,
          subject: t.subject,
          targetMinutes: t.target_minutes,
          done: t.done,
        }));
      }

      setPlans((prev) => [newPlan, ...prev]);
      return { error: null, plan: newPlan };
    },
    [],
  );

  const toggleTask = useCallback(
    async (planId: string, taskId: string): Promise<{ error: string | null }> => {
      const plan = plans.find((p) => p.id === planId);
      const task = plan?.tasks.find((t) => t.id === taskId);
      if (!task) return { error: 'Task not found' };

      const newDone = !task.done;

      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? {
                ...p,
                tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, done: newDone } : t)),
              }
            : p,
        ),
      );

      const { error } = await supabase
        .from('study_plan_tasks')
        .update({ done: newDone })
        .eq('id', taskId);

      if (error) {
        // Revert on error
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, done: task.done } : t)),
                }
              : p,
          ),
        );
        return { error: error.message };
      }

      return { error: null };
    },
    [plans],
  );

  const addTask = useCallback(
    async (planId: string, subject: string, targetMinutes: number): Promise<{ error: string | null }> => {
      const { data, error } = await supabase
        .from('study_plan_tasks')
        .insert({ plan_id: planId, subject, target_minutes: targetMinutes })
        .select('id, subject, target_minutes, done')
        .single();

      if (error) return { error: error.message };

      const newTask: StudyPlanTask = {
        id: (data as TaskRow).id,
        subject: (data as TaskRow).subject,
        targetMinutes: (data as TaskRow).target_minutes,
        done: (data as TaskRow).done,
      };

      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId ? { ...p, tasks: [...p.tasks, newTask] } : p,
        ),
      );

      return { error: null };
    },
    [],
  );

  const deletePlan = useCallback(
    async (planId: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.from('study_plans').delete().eq('id', planId);

      if (error) return { error: error.message };

      setPlans((prev) => prev.filter((p) => p.id !== planId));
      return { error: null };
    },
    [],
  );

  return { plans, loading, createPlan, toggleTask, addTask, deletePlan, reload: loadPlans };
}
