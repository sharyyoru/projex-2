-- ============================================
-- EMPLOYEE LEAVE MANAGEMENT SYSTEM (UAE Labor Laws)
-- ============================================

-- Add leave-related fields to users table
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS annual_leave_used numeric(5,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sick_leave_used numeric(5,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_leave_total numeric(5,1) NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sick_leave_total numeric(5,1) NOT NULL DEFAULT 90;

-- Create leave status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
    CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$$;

-- Create leave type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type') THEN
    CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'unpaid');
  END IF;
END
$$;

-- Leave requests table
CREATE TABLE IF NOT EXISTS leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type text NOT NULL CHECK (leave_type IN ('annual', 'sick', 'unpaid')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count numeric(5,1) NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_days_count CHECK (days_count > 0)
);

CREATE INDEX IF NOT EXISTS leaves_user_id_idx ON leaves(user_id);
CREATE INDEX IF NOT EXISTS leaves_status_idx ON leaves(status);
CREATE INDEX IF NOT EXISTS leaves_start_date_idx ON leaves(start_date);

-- AI daily quotes cache table (to avoid regenerating quotes)
CREATE TABLE IF NOT EXISTS daily_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  quote_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, quote_date)
);

CREATE INDEX IF NOT EXISTS daily_quotes_user_date_idx ON daily_quotes(user_id, quote_date);

-- Team schedule / project deadlines for AI leave recommender
CREATE TABLE IF NOT EXISTS team_schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_date date NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('deadline', 'meeting', 'milestone', 'holiday')),
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_schedule_events_date_idx ON team_schedule_events(event_date);

-- Add completed_at field to tasks if not exists (for "Finished Today" counter)
ALTER TABLE IF EXISTS tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Function to update completed_at when task status changes to completed
CREATE OR REPLACE FUNCTION update_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS task_completed_at_trigger ON tasks;
CREATE TRIGGER task_completed_at_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_completed_at();

-- Function to auto-deduct leave days when approved
CREATE OR REPLACE FUNCTION update_leave_balance_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    IF NEW.leave_type = 'annual' THEN
      UPDATE users 
      SET annual_leave_used = annual_leave_used + NEW.days_count
      WHERE id = NEW.user_id;
    ELSIF NEW.leave_type = 'sick' THEN
      UPDATE users 
      SET sick_leave_used = sick_leave_used + NEW.days_count
      WHERE id = NEW.user_id;
    END IF;
    NEW.reviewed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS leave_balance_update_trigger ON leaves;
CREATE TRIGGER leave_balance_update_trigger
  BEFORE UPDATE ON leaves
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_approval();

-- RLS Policies for leaves table
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

-- Users can view their own leaves
CREATE POLICY IF NOT EXISTS "Users can view own leaves"
  ON leaves FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own leaves
CREATE POLICY IF NOT EXISTS "Users can create own leaves"
  ON leaves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all leaves
CREATE POLICY IF NOT EXISTS "Admins can view all leaves"
  ON leaves FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'hr')
    )
  );

-- Admins can update leaves (for approvals)
CREATE POLICY IF NOT EXISTS "Admins can update leaves"
  ON leaves FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'hr')
    )
  );

-- Grant permissions
GRANT ALL ON leaves TO authenticated;
GRANT ALL ON daily_quotes TO authenticated;
GRANT ALL ON team_schedule_events TO authenticated;
