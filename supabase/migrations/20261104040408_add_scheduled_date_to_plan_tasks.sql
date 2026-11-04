/*
# Add scheduled date to study plan tasks

## Overview
Study plan tasks can now be placed on a specific day of the calendar, so the calendar
can show what to study today, tomorrow, and on any other day.

## Modified Tables

### study_plan_tasks
- `scheduled_date` (date, nullable): the day this task is planned for.
  Empty means the task is not yet placed on the calendar.

## Security
- No policy or grant changes. Existing owner-scoped RLS on study_plan_tasks still applies.

## Notes
1. Adding a nullable column does not change existing tasks; they stay unscheduled.
2. An index on scheduled_date keeps day lookups fast for the calendar.
*/

ALTER TABLE study_plan_tasks ADD COLUMN IF NOT EXISTS scheduled_date date;

CREATE INDEX IF NOT EXISTS idx_study_plan_tasks_scheduled_date ON study_plan_tasks(scheduled_date);
