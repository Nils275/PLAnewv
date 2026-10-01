/*
# Create HubSpot-style CRM tables + AI Agents table

1. New Tables
- `hubspot_contacts` — contacts with name, email, phone, company, lifecycle_stage, owner
- `hubspot_companies` — companies with name, domain, industry, size, website
- `hubspot_tickets` — support tickets with subject, priority, status, contact_id, company_id
- `ai_agents` — AI agent definitions with name, role, system_prompt, model, status, last_run

2. Security
- RLS enabled on all; single-tenant (anon + authenticated full CRUD)

3. Notes
- hubspot_contacts and hubspot_companies are separate from existing crm_deals
- ai_agents stores agent configs; execution logs can be added later
- Seeded with starter data
*/

CREATE TABLE IF NOT EXISTS hubspot_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text DEFAULT '',
  industry text DEFAULT '',
  size text DEFAULT '',
  website text DEFAULT '',
  city text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hubspot_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_hs_comp" ON hubspot_companies;
CREATE POLICY "anon_select_hs_comp" ON hubspot_companies FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_hs_comp" ON hubspot_companies;
CREATE POLICY "anon_insert_hs_comp" ON hubspot_companies FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_hs_comp" ON hubspot_companies;
CREATE POLICY "anon_update_hs_comp" ON hubspot_companies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_hs_comp" ON hubspot_companies;
CREATE POLICY "anon_delete_hs_comp" ON hubspot_companies FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS hubspot_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  job_title text DEFAULT '',
  company_id uuid REFERENCES hubspot_companies(id) ON DELETE SET NULL,
  company_name text DEFAULT '',
  lifecycle_stage text DEFAULT 'lead',
  owner text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hubspot_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_hs_cont" ON hubspot_contacts;
CREATE POLICY "anon_select_hs_cont" ON hubspot_contacts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_hs_cont" ON hubspot_contacts;
CREATE POLICY "anon_insert_hs_cont" ON hubspot_contacts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_hs_cont" ON hubspot_contacts;
CREATE POLICY "anon_update_hs_cont" ON hubspot_contacts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_hs_cont" ON hubspot_contacts;
CREATE POLICY "anon_delete_hs_cont" ON hubspot_contacts FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS hubspot_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  description text DEFAULT '',
  priority text DEFAULT 'medium',
  status text DEFAULT 'open',
  category text DEFAULT '',
  contact_id uuid REFERENCES hubspot_contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES hubspot_companies(id) ON DELETE SET NULL,
  owner text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hubspot_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_hs_tk" ON hubspot_tickets;
CREATE POLICY "anon_select_hs_tk" ON hubspot_tickets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_hs_tk" ON hubspot_tickets;
CREATE POLICY "anon_insert_hs_tk" ON hubspot_tickets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_hs_tk" ON hubspot_tickets;
CREATE POLICY "anon_update_hs_tk" ON hubspot_tickets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_hs_tk" ON hubspot_tickets;
CREATE POLICY "anon_delete_hs_tk" ON hubspot_tickets FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'assistant',
  description text DEFAULT '',
  system_prompt text DEFAULT '',
  model text DEFAULT 'gpt-4o',
  status text DEFAULT 'active',
  icon text DEFAULT 'sparkles',
  color text DEFAULT '#2563eb',
  last_run timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ai" ON ai_agents;
CREATE POLICY "anon_select_ai" ON ai_agents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ai" ON ai_agents;
CREATE POLICY "anon_insert_ai" ON ai_agents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ai" ON ai_agents;
CREATE POLICY "anon_update_ai" ON ai_agents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ai" ON ai_agents;
CREATE POLICY "anon_delete_ai" ON ai_agents FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_hs_contacts_company ON hubspot_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_hs_tickets_status ON hubspot_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(status);

-- Seed companies
INSERT INTO hubspot_companies (name, domain, industry, size, website, city) VALUES
('AutoSport Pro', 'autosportpro.fr', 'Sport automobile', '11-50', 'https://autosportpro.fr', 'Le Mans'),
('Circuit Digital', 'circuit-digital.com', 'Marketing digital', '6-10', 'https://circuit-digital.com', 'Paris'),
('Racing Media', 'racing-media.fr', 'Médias', '11-50', 'https://racing-media.fr', 'Magny-Cours'),
('Pole Position Events', 'poleposition-events.fr', 'Événementiel', '6-10', 'https://poleposition-events.fr', 'Lyon')
ON CONFLICT DO NOTHING;

-- Seed contacts
INSERT INTO hubspot_contacts (first_name, last_name, email, phone, job_title, company_name, lifecycle_stage, owner)
VALUES
('Marc', 'Dubois', 'marc.dubois@autosportpro.fr', '06 12 34 56 78', 'Directeur', 'AutoSport Pro', 'customer', 'Julien'),
('Sophie', 'Martin', 'sophie.martin@circuit-digital.com', '06 23 45 67 89', 'Responsable marketing', 'Circuit Digital', 'qualified', 'Nils'),
('Thomas', 'Lefebvre', 'thomas@racing-media.fr', '07 11 22 33 44', 'Rédacteur en chef', 'Racing Media', 'lead', 'Julien'),
('Claire', 'Rousseau', 'claire@poleposition-events.fr', '06 98 76 54 32', 'Event manager', 'Pole Position Events', 'opportunity', 'Nils')
ON CONFLICT DO NOTHING;

-- Seed tickets
INSERT INTO hubspot_tickets (subject, description, priority, status, category, owner)
VALUES
('Demande de devis événement Le Mans', 'Client souhaite un devis pour un événement au Mans en novembre', 'high', 'open', 'commercial', 'Julien'),
('Problème accès plateforme', 'Le contact ne parvient pas à se connecter', 'medium', 'pending', 'support', 'Nils'),
('Partenariat média 2026', 'Discussion en cours pour un partenariat média sur la saison 2026', 'low', 'open', 'partenariat', 'Julien')
ON CONFLICT DO NOTHING;

-- Seed AI agents
INSERT INTO ai_agents (name, role, description, system_prompt, model, status, icon, color) VALUES
('Jarvis', 'Assistant général', 'Assistant polyvalent pour la gestion quotidienne', 'Tu es Jarvis, un assistant IA polyvalent. Tu aides l''équipe à organiser le travail, répondre aux questions et automatiser des tâches. Tu parles français.', 'gpt-4o', 'active', 'sparkles', '#2563eb'),
('Veille Sport Auto', 'Veille médiatique', 'Surveille l''actualité du sport automobile en continu', 'Tu es un agent spécialisé dans la veille médiatique du sport automobile. Tu résumes les articles, identifies les tendances et alertes l''équipe des informations importantes.', 'gpt-4o', 'active', 'trend', '#0891b2'),
('CRM Booster', 'Commercial', 'Analyse les opportunités et propose des actions commerciales', 'Tu es un agent commercial. Tu analyses le pipeline CRM, identifies les opportunités à risque et proposes des actions pour avancer les deals.', 'gpt-4o', 'active', 'crm', '#16a34a'),
('Content Writer', 'Création de contenu', 'Rédige des posts pour les réseaux sociaux et le blog', 'Tu es un agent de création de contenu. Tu rédiges des posts pour les réseaux sociaux, des articles de blog et des newsletters sur le sport automobile.', 'gpt-4o', 'paused', 'edit', '#d97706'),
('Finance Watch', 'Finance', 'Surveille les flux financiers et alerte sur les retards de paiement', 'Tu es un agent financier. Tu surveilles les factures impayées, les retards de paiement et proposes des actions de relance.', 'gpt-4o', 'active', 'finance', '#dc2626')
ON CONFLICT DO NOTHING;
