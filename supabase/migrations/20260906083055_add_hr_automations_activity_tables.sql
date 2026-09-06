/*
# Add HR, Automations, and Activity Log tables

1. New Tables
- `hr_leaves` — leave/absence/telework requests (member_id, type, start_date, end_date, status, reason)
- `hr_objectives` — individual employee objectives (member_id, title, description, due_date, status, progress)
- `hr_onboarding_tasks` — onboarding checklist items (member_id, title, completed, due_date)
- `automations` — SI/ALORS automation rules (name, trigger_type, trigger_config, action_type, action_config, enabled, last_run, run_count)
- `activity_log` — recent activity feed (entity_type, entity_id, action, description, user_name, created_at)

2. Security
- All tables: RLS enabled, anon+authenticated CRUD (single-tenant app, no auth screen).
*/

-- HR Leave requests
CREATE TABLE IF NOT EXISTS hr_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'leave',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending',
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hr_leaves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_hr_leaves" ON hr_leaves;
CREATE POLICY "anon_select_hr_leaves" ON hr_leaves FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_hr_leaves" ON hr_leaves;
CREATE POLICY "anon_insert_hr_leaves" ON hr_leaves FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_hr_leaves" ON hr_leaves;
CREATE POLICY "anon_update_hr_leaves" ON hr_leaves FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_hr_leaves" ON hr_leaves;
CREATE POLICY "anon_delete_hr_leaves" ON hr_leaves FOR DELETE TO anon, authenticated USING (true);

-- HR Objectives
CREATE TABLE IF NOT EXISTS hr_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  due_date date,
  status text NOT NULL DEFAULT 'active',
  progress int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hr_objectives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_hr_obj" ON hr_objectives;
CREATE POLICY "anon_select_hr_obj" ON hr_objectives FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_hr_obj" ON hr_objectives;
CREATE POLICY "anon_insert_hr_obj" ON hr_objectives FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_hr_obj" ON hr_objectives;
CREATE POLICY "anon_update_hr_obj" ON hr_objectives FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_hr_obj" ON hr_objectives;
CREATE POLICY "anon_delete_hr_obj" ON hr_objectives FOR DELETE TO anon, authenticated USING (true);

-- HR Onboarding tasks
CREATE TABLE IF NOT EXISTS hr_onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  due_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hr_onboarding_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_hr_onb" ON hr_onboarding_tasks;
CREATE POLICY "anon_select_hr_onb" ON hr_onboarding_tasks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_hr_onb" ON hr_onboarding_tasks;
CREATE POLICY "anon_insert_hr_onb" ON hr_onboarding_tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_hr_onb" ON hr_onboarding_tasks;
CREATE POLICY "anon_update_hr_onb" ON hr_onboarding_tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_hr_onb" ON hr_onboarding_tasks;
CREATE POLICY "anon_delete_hr_onb" ON hr_onboarding_tasks FOR DELETE TO anon, authenticated USING (true);

-- Automations
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'deal_no_response',
  trigger_config jsonb DEFAULT '{}',
  action_type text NOT NULL DEFAULT 'create_task',
  action_config jsonb DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  last_run timestamptz,
  run_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_auto" ON automations;
CREATE POLICY "anon_select_auto" ON automations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_auto" ON automations;
CREATE POLICY "anon_insert_auto" ON automations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_auto" ON automations;
CREATE POLICY "anon_update_auto" ON automations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_auto" ON automations;
CREATE POLICY "anon_delete_auto" ON automations FOR DELETE TO anon, authenticated USING (true);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT '',
  entity_id text DEFAULT '',
  action text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  user_name text DEFAULT '',
  route text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_activity" ON activity_log;
CREATE POLICY "anon_select_activity" ON activity_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_activity" ON activity_log;
CREATE POLICY "anon_insert_activity" ON activity_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_activity" ON activity_log;
CREATE POLICY "anon_update_activity" ON activity_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_activity" ON activity_log;
CREATE POLICY "anon_delete_activity" ON activity_log FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_leaves_member ON hr_leaves(member_id);
CREATE INDEX IF NOT EXISTS idx_hr_obj_member ON hr_objectives(member_id);
CREATE INDEX IF NOT EXISTS idx_hr_onb_member ON hr_onboarding_tasks(member_id);
