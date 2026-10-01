/*
# Create brain_notes table — Obsidian-style knowledge graph

1. New Tables
- `brain_notes` — knowledge notes with wiki-style links and tags
  - `id` (uuid, primary key)
  - `title` (text, not null) — note title
  - `content` (text) — note body, supports [[wiki links]] and #tags
  - `tags` (text[]) — array of tags for filtering
  - `color` (text) — visual color for the graph node
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- RLS enabled; single-tenant with app-level auth (anon + authenticated full CRUD)

3. Notes
- Wiki links [[Note Title]] are parsed client-side to build the graph
- Tags #tag are extracted client-side from content
- Seeded with starter notes about the business
*/

CREATE TABLE IF NOT EXISTS brain_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text DEFAULT '',
  tags text[] DEFAULT '{}',
  color text DEFAULT '#2563eb',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE brain_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_brain" ON brain_notes;
CREATE POLICY "anon_select_brain" ON brain_notes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_brain" ON brain_notes;
CREATE POLICY "anon_insert_brain" ON brain_notes FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_brain" ON brain_notes;
CREATE POLICY "anon_update_brain" ON brain_notes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_brain" ON brain_notes;
CREATE POLICY "anon_delete_brain" ON brain_notes FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_brain_tags ON brain_notes USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_brain_title ON brain_notes(title);

-- Seed starter notes
INSERT INTO brain_notes (title, content, tags, color) VALUES
('Stratégie 2026', 'Nos objectifs pour 2026:\n- Développer le [[CRM]] pour mieux suivre les prospects\n- Automatiser la [[Facturation]] avec des relances\n- Améliorer le [[Suivi du temps]] pour le reporting\n\n#strategie #objectifs', '{"strategie","objectifs"}', '#2563eb'),
('CRM', 'Le [[CRM]] centralise tous nos prospects et opportunités.\n\nLié à: [[Clients]], [[Facturation]], [[Communication]]\n\n#business #crm', '{"business","crm"}', '#0891b2'),
('Clients', 'Gestion de la relation client.\n\nVoir aussi: [[CRM]], [[Projets]], [[Facturation]]\n\n#business #clients', '{"business","clients"}', '#16a34a'),
('Facturation', 'Système de facturation et devis.\n\nRelié à [[Clients]] et [[Finance]].\nLes [[Automatisations]] peuvent générer des factures.\n\n#finance #facturation', '{"finance","facturation"}', '#d97706'),
('Finance', 'Suivi financier global: revenus, dépenses, prévisionnel.\n\nLié à [[Facturation]] et [[Projets]].\n\n#finance', '{"finance"}', '#059669'),
('Projets', 'Gestion de projets et missions.\n\nChaque projet est lié à un [[Clients]] et peut générer de la [[Facturation]].\nLe [[Suivi du temps]] alimente le [[Reporting]].\n\n#projets #management', '{"projets","management"}', '#7c3aed'),
('Suivi du temps', 'Tracking du temps passé sur chaque [[Projets]].\n\nAlimente le [[Reporting]] et la [[Facturation]].\n\n#temps #tracking', '{"temps","tracking"}', '#f59e0b'),
('Communication', 'Canaux de communication: email, téléphone, réunions.\n\nLié au [[CRM]] et aux [[Clients]].\n\n#communication', '{"communication"}', '#db2777'),
('Automatisations', 'Règles SI...ALORS pour automatiser:\n- Créer des tâches automatiquement\n- Générer des [[Facturation]] depuis les devis acceptés\n- Relancer les [[Clients]] sans réponse\n\n#automatisation #productivite', '{"automatisation","productivite"}', '#dc2626'),
('Reporting', 'Rapports clients et analytics.\n\nDonnées issues du [[Suivi du temps]], [[CRM]], [[Finance]].\n\n#reporting #analytics', '{"reporting","analytics"}', '#0d9488'),
('Équipe', 'Gestion des collaborateurs, congés, objectifs.\n\nVoir [[RH]] et [[Agenda]].\n\n#equipe #rh', '{"equipe","rh"}', '#4f46e5'),
('RH', 'Espace privé RH: congés, objectifs, onboarding.\n\nGéré par Julien et Nils uniquement.\n\n#rh #prive', '{"rh","prive"}', '#9333ea'),
('Agenda', 'Planning partagé de l équipe.\n\nLes [[Tâches]] y apparaissent automatiquement.\nVue par collaborateur possible.\n\n#agenda #planning', '{"agenda","planning"}', '#3b82f6'),
('Tâches', 'Kanban de tâches assignées aux collaborateurs.\n\nLes tâches avec une date limite apparaissent dans l [[Agenda]].\nLes [[Automatisations]] peuvent en créer automatiquement.\n\n#taches #productivite', '{"taches","productivite"}', '#ef4444')
ON CONFLICT DO NOTHING;
