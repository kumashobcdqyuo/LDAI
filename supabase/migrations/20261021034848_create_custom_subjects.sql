/*
# Create custom_subjects table

## Overview
Users can now add their own study subjects beyond the default list (数学, 英語, etc.).
This table stores per-user custom subjects.

## New Tables
- `custom_subjects`
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner, defaults to auth.uid())
  - `name` (text, subject name)
  - `created_at` (timestamptz)

## Security
- RLS enabled, owner-scoped CRUD (authenticated only).
- Unique constraint on (user_id, name) to prevent duplicates.
*/

CREATE TABLE IF NOT EXISTS custom_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE custom_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subjects" ON custom_subjects;
CREATE POLICY "select_own_subjects" ON custom_subjects
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_subjects" ON custom_subjects;
CREATE POLICY "insert_own_subjects" ON custom_subjects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_subjects" ON custom_subjects;
CREATE POLICY "delete_own_subjects" ON custom_subjects
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
