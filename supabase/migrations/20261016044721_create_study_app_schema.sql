/*
# Create profiles and study_records tables for the learning dashboard

## Overview
This migration creates the core schema for a multi-user learning dashboard app.
Users sign in with email/password (Supabase Auth). Each user has a profile
with a display name and avatar color. Users can create, update, and delete
their own study records, and can read (but not modify) all other users'
records for the community comparison feature.

## New Tables

### profiles
- `id` (uuid, primary key, references auth.users) — one row per user
- `name` (text, not null) — display name shown in the app
- `avatar_color` (text, not null, default '#0d9488') — hex color for avatar
- `created_at` (timestamptz, default now())

### study_records
- `id` (uuid, primary key)
- `user_id` (uuid, not null, default auth.uid(), references auth.users) — owner
- `date` (date, not null) — the study date (YYYY-MM-DD)
- `subject` (text, not null) — subject name (数学, 英語, etc.)
- `minutes` (integer, not null, check > 0) — study duration in minutes
- `memo` (text, not null, default '') — short note
- `created_at` (timestamptz, default now())

## Security (RLS)

### profiles
- SELECT: any authenticated user can read all profiles (needed for community ranking)
- INSERT: a user can insert only their own profile
- UPDATE: a user can update only their own profile
- DELETE: a user can delete only their own profile

### study_records
- SELECT: any authenticated user can read ALL study records (community comparison is read-only)
- INSERT: a user can insert only their own records (user_id defaults to auth.uid())
- UPDATE: a user can update only their own records
- DELETE: a user can delete only their own records

## Notes
1. `user_id` on study_records defaults to `auth.uid()` so frontend inserts
   that omit `user_id` still pass the INSERT WITH CHECK.
2. A trigger auto-creates a profile row when a new auth user signs up.
3. No email confirmation required (off by default per Supabase auth settings).
*/

-- ========================
-- profiles table
-- ========================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_color text NOT NULL DEFAULT '#0d9488',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_all_profiles" ON profiles;
CREATE POLICY "select_all_profiles"
  ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile"
  ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ========================
-- study_records table
-- ========================
CREATE TABLE IF NOT EXISTS study_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  subject text NOT NULL,
  minutes integer NOT NULL CHECK (minutes > 0),
  memo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE study_records ENABLE ROW LEVEL SECURITY;

-- Everyone can read all records (community comparison)
DROP POLICY IF EXISTS "select_all_study_records" ON study_records;
CREATE POLICY "select_all_study_records"
  ON study_records FOR SELECT
  TO authenticated USING (true);

-- Only owner can insert/update/delete
DROP POLICY IF EXISTS "insert_own_study_records" ON study_records;
CREATE POLICY "insert_own_study_records"
  ON study_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_study_records" ON study_records;
CREATE POLICY "update_own_study_records"
  ON study_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_study_records" ON study_records;
CREATE POLICY "delete_own_study_records"
  ON study_records FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_study_records_user_date ON study_records(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_study_records_date ON study_records(date DESC);

-- ========================
-- Auto-create profile on signup
-- ========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', '#0d9488')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
