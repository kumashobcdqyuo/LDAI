/*
# Create chat_feedback table

1. New Tables
- `chat_feedback`
  - `id` (uuid, primary key)
  - `conversation_id` (uuid, references chat_conversations, cascade delete)
  - `message_role` (text: 'user' or 'assistant')
  - `message_content` (text: the AI message that was rated)
  - `rating` (text: 'good' or 'bad')
  - `request` (text: free-text improvement request from user)
  - `created_at` (timestamptz, default now())
  - `user_id` (uuid, defaults to auth.uid(), references auth.users)

2. Security
- Enable RLS on `chat_feedback`.
- Grant CRUD to `authenticated` only.
- Owner-scoped: users can only access their own feedback.
*/

CREATE TABLE IF NOT EXISTS chat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_role text NOT NULL DEFAULT 'assistant',
  message_content text NOT NULL,
  rating text NOT NULL CHECK (rating IN ('good', 'bad')),
  request text,
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE chat_feedback ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON chat_feedback TO authenticated;

DROP POLICY IF EXISTS "select_own_feedback" ON chat_feedback;
CREATE POLICY "select_own_feedback" ON chat_feedback FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_feedback" ON chat_feedback;
CREATE POLICY "insert_own_feedback" ON chat_feedback FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_feedback" ON chat_feedback;
CREATE POLICY "update_own_feedback" ON chat_feedback FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_feedback" ON chat_feedback;
CREATE POLICY "delete_own_feedback" ON chat_feedback FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
