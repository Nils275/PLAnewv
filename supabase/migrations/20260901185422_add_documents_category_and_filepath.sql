-- Add file_path column (storage path for deletion) and category column (rubrique)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path text DEFAULT '';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

-- Backfill file_path from file_url for existing rows where file_path is empty
UPDATE documents SET file_path = split_part(file_url, '/documents/', 2) WHERE file_path = '' AND file_url LIKE '%/documents/%';
