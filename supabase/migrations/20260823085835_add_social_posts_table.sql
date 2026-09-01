/*
# Create social_posts table

1. New Tables
- `social_posts`
  - `id` (uuid, primary key)
  - `title` (text, not null)
  - `content` (text)
  - `platform` (text, default 'instagram') — instagram, facebook, linkedin, twitter, tiktok
  - `status` (text, default 'idea') — idea, draft, scheduled, published, cancelled
  - `scheduled_date` (date)
  - `client_id` (uuid, nullable, FK to clients)
  - `project_id` (uuid, nullable, FK to projects)
  - `assignee` (text)
  - `hashtags` (text)
  - `media_url` (text)
  - `created_at` (timestamptz)

2. Security
- Enable RLS.
- Allow anon + authenticated CRUD (single-tenant).
*/

CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text DEFAULT '',
  platform text NOT NULL DEFAULT 'instagram',
  status text NOT NULL DEFAULT 'idea',
  scheduled_date date,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  assignee text DEFAULT '',
  hashtags text DEFAULT '',
  media_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_sp_s" ON social_posts;
CREATE POLICY "anon_sp_s" ON social_posts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_sp_i" ON social_posts;
CREATE POLICY "anon_sp_i" ON social_posts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_sp_u" ON social_posts;
CREATE POLICY "anon_sp_u" ON social_posts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_sp_d" ON social_posts;
CREATE POLICY "anon_sp_d" ON social_posts FOR DELETE TO anon, authenticated USING (true);
