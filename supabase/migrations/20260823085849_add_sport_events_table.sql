/*
# Create sport_events table

1. New Tables
- `sport_events`
  - `id` (uuid, primary key)
  - `name` (text, not null) — event name e.g. "Rallye Monte-Carlo"
  - `discipline` (text) — rally, circuit, endurance, f1, gt, karting
  - `location` (text) — circuit/venue
  - `start_date` (date)
  - `end_date` (date)
  - `status` (text, default 'upcoming') — upcoming, live, completed, cancelled
  - `client_id` (uuid, nullable, FK to clients) — linked client/sponsor
  - `project_id` (uuid, nullable, FK to projects)
  - `drivers` (text) — driver names, comma-separated
  - `team` (text) — team name
  - `result` (text) — result summary
  - `position` (integer) — finishing position
  - `notes` (text)
  - `created_at` (timestamptz)

2. Security
- Enable RLS.
- Allow anon + authenticated CRUD (single-tenant).
*/

CREATE TABLE IF NOT EXISTS sport_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  discipline text DEFAULT '',
  location text DEFAULT '',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'upcoming',
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  drivers text DEFAULT '',
  team text DEFAULT '',
  result text DEFAULT '',
  position integer,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sport_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_se_s" ON sport_events;
CREATE POLICY "anon_se_s" ON sport_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_se_i" ON sport_events;
CREATE POLICY "anon_se_i" ON sport_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_se_u" ON sport_events;
CREATE POLICY "anon_se_u" ON sport_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_se_d" ON sport_events;
CREATE POLICY "anon_se_d" ON sport_events FOR DELETE TO anon, authenticated USING (true);
