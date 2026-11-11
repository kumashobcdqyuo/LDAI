/*
# Add structured question responses to chat_feedback

1. Changes
- Add `question_responses` JSONB column to `chat_feedback` table
- Stores structured per-item feedback as an array of {question, answer, score} objects
- Existing rows remain valid (column is nullable, defaults to NULL)

2. Security
- No policy changes needed; column inherits existing RLS policies on chat_feedback
- Column is user-writable (same ownership rules apply)
*/

ALTER TABLE chat_feedback
  ADD COLUMN IF NOT EXISTS question_responses JSONB DEFAULT NULL;
