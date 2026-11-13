/*
# Create ai_call_logs table for diagnosing advisor model failures

1. New Tables
- `ai_call_logs`
  - `id` (uuid, primary key)
  - `created_at` (timestamptz, default now)
  - `model` (text) - model identifier that was requested
  - `outcome` (text) - e.g. 'no_key', 'upstream_error', 'exception'
  - `http_status` (integer, nullable) - HTTP status returned by the model provider
  - `error_body` (text, nullable) - provider error body (truncated), never contains API keys

2. Security
- Enable RLS on `ai_call_logs`.
- Grant INSERT and SELECT to `service_role` only, used by the chat edge function.
- No policies for `anon` or `authenticated`, so the browser cannot read or write these logs.

3. Notes
- Rows are written only when the advisor cannot return a model reply.
*/

CREATE TABLE IF NOT EXISTS ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  outcome text NOT NULL,
  http_status integer,
  error_body text
);

ALTER TABLE ai_call_logs ENABLE ROW LEVEL SECURITY;

GRANT INSERT, SELECT ON ai_call_logs TO service_role;
