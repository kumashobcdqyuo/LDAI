/*
# Create study_plans and study_plan_tasks tables

## Overview
Adds user study plans with individual tasks. Each plan has a title, optional goal text,
start/end dates, and a list of tasks (each with subject, target minutes, and done flag).
Users can track progress by marking tasks done; the dashboard shows plan progress.

## New Tables

### study_plans
- `id` (uuid, primary key)
- `user_id` (uuid, owner, defaults to auth.uid())
- `title` (text, plan name)
- `goal` (text, optional goal description)
- `start_date` (date, when the plan starts)
- `end_date` (date, when the plan ends)
- `created_at` (timestamptz)

### study_plan_tasks
- `id` (uuid, primary key)
- `plan_id` (uuid, foreign key to study_plans, cascade delete)
- `subject` (text, study subject)
- `target_minutes` (int, target study minutes for this task)
- `done` (boolean, whether the task is completed)
- `created_at` (timestamptz)

## Security
- RLS enabled on both tables, owner-scoped CRUD (authenticated only).
- study_plan_tasks policies check ownership via the parent study_plans table.
*/

CREATE TABLE IF NOT EXISTS study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  goal text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON study_plans TO authenticated;

DROP POLICY IF EXISTS "select_own_plans" ON study_plans;
CREATE POLICY "select_own_plans" ON study_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_plans" ON study_plans;
CREATE POLICY "insert_own_plans" ON study_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_plans" ON study_plans;
CREATE POLICY "update_own_plans" ON study_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_plans" ON study_plans;
CREATE POLICY "delete_own_plans" ON study_plans
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS study_plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  subject text NOT NULL,
  target_minutes int NOT NULL DEFAULT 30,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE study_plan_tasks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON study_plan_tasks TO authenticated;

DROP POLICY IF EXISTS "select_own_plan_tasks" ON study_plan_tasks;
CREATE POLICY "select_own_plan_tasks" ON study_plan_tasks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_tasks.plan_id AND study_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_plan_tasks" ON study_plan_tasks;
CREATE POLICY "insert_own_plan_tasks" ON study_plan_tasks
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_tasks.plan_id AND study_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_plan_tasks" ON study_plan_tasks;
CREATE POLICY "update_own_plan_tasks" ON study_plan_tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_tasks.plan_id AND study_plans.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_tasks.plan_id AND study_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_plan_tasks" ON study_plan_tasks;
CREATE POLICY "delete_own_plan_tasks" ON study_plan_tasks
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM study_plans WHERE study_plans.id = study_plan_tasks.plan_id AND study_plans.user_id = auth.uid())
  );
