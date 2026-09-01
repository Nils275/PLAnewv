/*
# Create invoices and invoice_items tables

1. New Tables
- `invoices`
  - `id` (uuid, primary key)
  - `number` (text, unique) — invoice number e.g. FAC-2026-001
  - `client_id` (uuid, FK to clients)
  - `deal_id` (uuid, nullable, FK to crm_deals)
  - `issue_date` (date, not null)
  - `due_date` (date)
  - `status` (text, default 'draft') — draft, sent, paid, overdue
  - `subtotal` (numeric, default 0)
  - `tax_rate` (numeric, default 20) — VAT percentage
  - `tax_amount` (numeric, default 0)
  - `total` (numeric, default 0)
  - `notes` (text)
  - `paid_date` (date)
  - `created_at` (timestamptz)

- `invoice_items`
  - `id` (uuid, primary key)
  - `invoice_id` (uuid, FK to invoices ON DELETE CASCADE)
  - `description` (text, not null)
  - `quantity` (numeric, default 1)
  - `unit_price` (numeric, default 0)
  - `total` (numeric, default 0)
  - `time_entry_id` (uuid, nullable, FK to time_entries)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD (single-tenant app).
*/

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 20,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  paid_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_crud_invoices_s" ON invoices;
CREATE POLICY "anon_crud_invoices_s" ON invoices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_invoices_i" ON invoices;
CREATE POLICY "anon_crud_invoices_i" ON invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_invoices_u" ON invoices;
CREATE POLICY "anon_crud_invoices_u" ON invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_invoices_d" ON invoices;
CREATE POLICY "anon_crud_invoices_d" ON invoices FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_crud_invitems_s" ON invoice_items;
CREATE POLICY "anon_crud_invitems_s" ON invoice_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_invitems_i" ON invoice_items;
CREATE POLICY "anon_crud_invitems_i" ON invoice_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_invitems_u" ON invoice_items;
CREATE POLICY "anon_crud_invitems_u" ON invoice_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_invitems_d" ON invoice_items;
CREATE POLICY "anon_crud_invitems_d" ON invoice_items FOR DELETE TO anon, authenticated USING (true);
