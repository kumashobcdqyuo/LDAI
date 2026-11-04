/*
# Link study records to study plan tasks

## Overview
When a study plan task is marked done, a matching study record is now created so the
task's time shows up on the dashboard. This migration adds the link between the two.

## Modified Tables

### study_records
- `plan_task_id` (uuid, nullable): the study plan task this record was generated from.
  Manually entered records leave it empty.
- Foreign key to study_plan_tasks(id). If the task is deleted, the record is kept
  (the link is cleared) so past study history is never lost.

## Security
- No policy or grant changes. Existing owner-scoped RLS on study_records still applies.

## Notes
1. Adding a nullable column does not change existing rows.
2. An index on plan_task_id keeps lookups fast when a task is un-done and its record is removed.
*/

ALTER TABLE study_records ADD COLUMN IF NOT EXISTS plan_task_id uuid REFERENCES study_plan_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_study_records_plan_task_id ON study_records(plan_task_id);
