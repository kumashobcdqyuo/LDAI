/*
# Create chat_memories table

1. New Tables
- `chat_memories`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users with cascade delete)
  - `role` (text, not null) — 'user' or 'assistant'
  - `content` (text, not null) — the message content
  - `created_at` (timestamptz, default now())

2. Purpose
Stores AI chat conversation history per user so that the chat edge function can
reference past conversations (memory) when generating replies. This enables
the AI to give more personalized, context-aware advice over multiple sessions.

3. Security
- Enable RLS on `chat_memories`.
- Grant CRUD to `authenticated` only (requires sign-in).
- Owner-scoped CRUD: each authenticated user can only access their own memories.
- user_id defaults to auth.uid() so inserts without explicit user_id succeed.
*/

CREATE TABLE IF NOT EXISTS chat_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_memories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON chat_memories TO authenticated;

CREATE INDEX IF NOT EXISTS chat_memories_user_created_idx
  ON chat_memories(user_id, created_at DESC);

DROP POLICY IF EXISTS "select_own_chat_memories" ON chat_memories;
CREATE POLICY "select_own_chat_memories"
  ON chat_memories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_memories" ON chat_memories;
CREATE POLICY "insert_own_chat_memories"
  ON chat_memories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_memories" ON chat_memories;
CREATE POLICY "update_own_chat_memories"
  ON chat_memories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_memories" ON chat_memories;
CREATE POLICY "delete_own_chat_memories"
  ON chat_memories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
