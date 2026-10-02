/*
# Create prospects table for prospect scanning feature

1. New Table
- `prospects` — potential clients discovered via scanning

2. Security
- RLS enabled; anon + authenticated full CRUD

3. Notes
- Seeded with sample data around Le Mans area
*/

CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text DEFAULT '',
  city text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  distance_km numeric DEFAULT 0,
  score integer DEFAULT 50,
  status text DEFAULT 'new',
  source text DEFAULT 'scan',
  notes text DEFAULT '',
  scanned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_prosp" ON prospects;
CREATE POLICY "anon_select_prosp" ON prospects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_prosp" ON prospects;
CREATE POLICY "anon_insert_prosp" ON prospects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_prosp" ON prospects;
CREATE POLICY "anon_update_prosp" ON prospects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_prosp" ON prospects;
CREATE POLICY "anon_delete_prosp" ON prospects FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_score ON prospects(score DESC);

INSERT INTO prospects (name, industry, city, address, phone, email, website, distance_km, score, status, source, notes) VALUES
('Garage Sport Auto Le Mans', 'Garage automobile', 'Le Mans', '12 Rue de la Gare, 72000 Le Mans', '02 43 12 34 56', 'contact@garage-sport-auto-lemans.fr', 'https://garage-sport-auto-lemans.fr', 2.5, 85, 'new', 'scan', 'Specialise vehicules sport, potentiel partenaire evenement'),
('Circuit des 24 Heures', 'Circuit automobile', 'Le Mans', 'Route de Laval, 72000 Le Mans', '02 43 40 20 20', 'contact@lemans-circuit.com', 'https://lemans-circuit.com', 5.0, 92, 'new', 'scan', 'Circuit mythique, contact deja etabli en 2025'),
('Auto Ecole Pilotage', 'Formation pilotage', 'Mulsanne', 'Rte du Mans, 72650 Mulsanne', '02 43 56 78 90', 'info@auto-ecole-pilotage.fr', 'https://auto-ecole-pilotage.fr', 8.0, 72, 'new', 'scan', 'Ecole de pilotage, interessant pour partenariat formation'),
('Prestige Automotive', 'Vente vehicules premium', 'Le Mans', '45 Avenue Jean Jaures, 72000 Le Mans', '02 43 89 01 23', 'contact@prestige-automotive.fr', 'https://prestige-automotive.fr', 3.2, 68, 'contacted', 'scan', 'Concessionnaire premium, potentiel sponsor'),
('Racing Parts Supplies', 'Pieces detachees', 'Allonnes', 'ZI Allonnes, 72700 Allonnes', '02 43 45 67 89', 'sales@racing-parts-supplies.fr', 'https://racing-parts-supplies.fr', 7.5, 75, 'new', 'scan', 'Fournisseur pieces racing, bon contact pour approvisionnement'),
('Media Sport Communication', 'Agence communication', 'Le Mans', '23 Rue Nationale, 72000 Le Mans', '02 43 23 45 67', 'bonjour@media-sport-com.fr', 'https://media-sport-com.fr', 1.8, 80, 'new', 'scan', 'Agence specialisee sport auto, pourrait aider communication'),
('Team Endurance Racing', 'Ecurie de course', 'La Chartre-sur-le-Loir', 'Route de Tours, 72340 La Chartre-sur-le-Loir', '02 43 78 90 12', 'team@endurance-racing.fr', 'https://endurance-racing.fr', 25.0, 65, 'new', 'scan', 'Ecurie endurance, potentiel collaboration evenement'),
('Automobile Club Ouest', 'Organisation evenements', 'Le Mans', '15 Place de la Republique, 72000 Le Mans', '02 43 40 30 30', 'aco@aco.fr', 'https://aco.fr', 2.0, 95, 'contacted', 'scan', 'Organisateur 24h du Mans, contact strategique'),
('Pit Stop Restaurant', 'Restauration evenementielle', 'Le Mans', '8 Quai Louis Blanc, 72000 Le Mans', '02 43 11 22 33', 'contact@pitstop-restaurant.fr', 'https://pitstop-restaurant.fr', 1.5, 55, 'new', 'scan', 'Restaurant theme sport auto, possible lieu evenement'),
('Dyno Tuning Performance', 'Preparation moteur', 'Rouillon', 'Zone Artisanale, 72220 Rouillon', '02 43 56 12 34', 'info@dyno-tuning-perf.fr', 'https://dyno-tuning-perf.fr', 12.0, 60, 'new', 'scan', 'Specialiste prepa moteur, interessant pour partenariat technique')
ON CONFLICT DO NOTHING;
