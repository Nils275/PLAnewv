/*
# Create time_entries table

1. New Tables
- `time_entries`
  - `id` (uuid, primary key)
  - `description` (text, not null) — what was done
  - `task_id` (uuid, nullable, FK to tasks) — linked task
  - `project_id` (uuid, nullable, FK to projects) — linked project
  - `client_id` (uuid, nullable, FK to clients) — linked client
  - `member_name` (text, not null) — who logged the time (matches team member name)
  - `duration_minutes` (integer, not null, default 0) — time spent in minutes
  - `billable` (boolean, default true) — whether this time is billable
  - `hourly_rate` (numeric, default 50) — rate in €/hour for billing
  - `date` (date, not null, default current date) — when the work was done
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `time_entries`.
- Allow anon + authenticated CRUD (single-tenant, no auth app).
*/

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  member_name text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 0,
  billable boolean DEFAULT true,
  hourly_rate numeric NOT NULL DEFAULT 50,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_time" ON time_entries;
CREATE POLICY "anon_select_time" ON time_entries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_time" ON time_entries;
CREATE POLICY "anon_insert_time" ON time_entries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_time" ON time_entries;
CREATE POLICY "anon_update_time" ON time_entries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_time" ON time_entries;
CREATE POLICY "anon_delete_time" ON time_entries FOR DELETE
  TO anon, authenticated USING (true);
