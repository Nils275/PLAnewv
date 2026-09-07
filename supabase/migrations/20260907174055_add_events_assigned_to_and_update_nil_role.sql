/*
# Add assigned_to to events + update Nils role to admin

1. Changes to existing tables
- `events` — add `assigned_to` (text) column to track which team member the event is assigned to
- `app_users` — update Nils role from 'member' to 'admin' so both Julien and Nils can manage HR

2. Trigger update
- `sync_task_event()` — updated to also copy the task's assignee into events.assigned_to

3. Security
- No new tables; existing RLS policies remain unchanged (single-tenant, anon + authenticated full CRUD)
*/

-- Add assigned_to column to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS assigned_to text DEFAULT '';

-- Update Nils to admin so both Julien and Nils can access HR
UPDATE app_users SET role = 'admin' WHERE name = 'Nils';

-- Update the trigger function to also sync assignee
CREATE OR REPLACE FUNCTION sync_task_event()
RETURNS TRIGGER AS $$
DECLARE
  existing_event uuid;
BEGIN
  IF NEW.due_date IS NOT NULL THEN
    SELECT id INTO existing_event FROM events WHERE task_id = NEW.id;
    IF existing_event IS NULL THEN
      INSERT INTO events (title, type, start_ts, end_ts, all_day, color, task_id, project_id, assigned_to)
      VALUES (NEW.title, 'task', NEW.due_date::timestamp + interval '9 hours', NEW.due_date::timestamp + interval '10 hours', false, '#dc2626', NEW.id, NEW.project_id, NEW.assignee);
    ELSE
      UPDATE events SET
        title = NEW.title,
        start_ts = NEW.due_date::timestamp + interval '9 hours',
        end_ts = NEW.due_date::timestamp + interval '10 hours',
        project_id = NEW.project_id,
        assigned_to = NEW.assignee
      WHERE id = existing_event;
    END IF;
  END IF;
  IF (TG_OP = 'UPDATE' AND NEW.due_date IS NULL AND OLD.due_date IS NOT NULL) THEN
    DELETE FROM events WHERE task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill assigned_to for existing task-linked events
UPDATE events SET assigned_to = t.assignee
FROM tasks t
WHERE events.task_id = t.id AND events.assigned_to = '';

CREATE INDEX IF NOT EXISTS idx_events_assigned_to ON events(assigned_to);
