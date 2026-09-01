/*
# Enhance invoices system: payments, quotes, recurring, discounts

1. Modified Tables
- `invoices`
  - ADD `type` (text, default 'invoice') — 'invoice' or 'quote'
  - ADD `discount_percent` (numeric, default 0) — percentage discount
  - ADD `discount_amount` (numeric, default 0) — fixed amount discount
  - ADD `recurring` (boolean, default false) — recurring invoice
  - ADD `recurring_interval` (text) — 'monthly', 'quarterly', 'yearly'
  - ADD `parent_invoice_id` (uuid, nullable, FK invoices) — for recurring children
  - ADD `sent_date` (date) — when invoice was sent
  - ADD `late_fee_applied` (numeric, default 0) — late fee amount added
  - ADD `email` (text) — email address sent to
  - ADD `next_invoice_date` (date) — next recurring invoice date

2. New Tables
- `payments`
  - `id` (uuid, primary key)
  - `invoice_id` (uuid, FK invoices ON DELETE CASCADE)
  - `amount` (numeric, not null)
  - `method` (text) — 'card', 'transfer', 'check', 'cash', 'other'
  - `reference` (text) — payment reference/transaction id
  - `date` (date, not null, default current date)
  - `notes` (text)
  - `created_at` (timestamptz)

3. Security
- Enable RLS on `payments`.
- Allow anon + authenticated CRUD (single-tenant).
*/

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'invoice';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_interval text DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS parent_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS late_fee_applied numeric NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS next_invoice_date date;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'transfer',
  reference text DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_pay_s" ON payments;
CREATE POLICY "anon_pay_s" ON payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_pay_i" ON payments;
CREATE POLICY "anon_pay_i" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_pay_u" ON payments;
CREATE POLICY "anon_pay_u" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_pay_d" ON payments;
CREATE POLICY "anon_pay_d" ON payments FOR DELETE TO anon, authenticated USING (true);
