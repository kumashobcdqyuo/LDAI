/*
# Create chat_conversations table and link chat_memories to it
*/

CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '新しいチャット',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON chat_conversations TO authenticated;

DROP POLICY IF EXISTS "select_own_conversations" ON chat_conversations;
CREATE POLICY "select_own_conversations"
  ON chat_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_conversations" ON chat_conversations;
CREATE POLICY "insert_own_conversations"
  ON chat_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_conversations" ON chat_conversations;
CREATE POLICY "update_own_conversations"
  ON chat_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_conversations" ON chat_conversations;
CREATE POLICY "delete_own_conversations"
  ON chat_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

ALTER TABLE chat_memories ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS chat_memories_conversation_created_idx
  ON chat_memories(conversation_id, created_at ASC);

-- Backfill: create a default conversation for existing memories
INSERT INTO chat_conversations (user_id, title)
SELECT DISTINCT user_id, '過去のチャット' FROM chat_memories WHERE conversation_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE chat_memories
SET conversation_id = sub.id
FROM (
  SELECT user_id, (array_agg(id ORDER BY created_at))[1] as id FROM chat_conversations GROUP BY user_id
) sub
WHERE chat_memories.conversation_id IS NULL AND chat_memories.user_id = sub.user_id;

CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_conversation_updated_at();
