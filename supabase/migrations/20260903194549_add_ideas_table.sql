/*
# Create ideas table

1. New Tables
- `ideas` — centralizes ideas for client work and company development
  - `id` (uuid, primary key)
  - `title` (text, not null) — short name of the idea
  - `description` (text) — detailed explanation
  - `scope` (text) — 'client' or 'company' (idea for a specific client, or for the company's own development)
  - `client_id` (uuid, nullable, FK to clients) — set when scope = 'client'
  - `project_id` (uuid, nullable, FK to projects) — optional link to a project
  - `status` (text) — 'new', 'exploring', 'planned', 'in_progress', 'done', 'archived'
  - `priority` (text) — 'low', 'medium', 'high'
  - `tags` (text) — comma-separated tags
  - `created_by` (text) — author name
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- RLS enabled, single-tenant (no sign-in) so anon + authenticated have full CRUD.
*/

CREATE TABLE IF NOT EXISTS ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  scope text NOT NULL DEFAULT 'company',
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'medium',
  tags text DEFAULT '',
  created_by text DEFAULT 'Moi',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ideas" ON ideas;
CREATE POLICY "anon_select_ideas" ON ideas FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ideas" ON ideas;
CREATE POLICY "anon_insert_ideas" ON ideas FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ideas" ON ideas;
CREATE POLICY "anon_update_ideas" ON ideas FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ideas" ON ideas;
CREATE POLICY "anon_delete_ideas" ON ideas FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ideas_client ON ideas(client_id);
CREATE INDEX IF NOT EXISTS idx_ideas_scope ON ideas(scope);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
