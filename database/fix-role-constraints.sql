-- Database Migration: Fix Role Constraints and Add Role Level
-- This script updates the users table to support the new role system

-- 1. Drop existing role constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Add role_level column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_level INTEGER;

-- 3. Create new role constraint with updated roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'manager', 'coach', 'player', 'analyst', 'pending'));

-- 4. Update existing users to use new role system
-- Convert old roles to new roles
UPDATE users SET role = 'pending' WHERE role = 'pending_player';
UPDATE users SET role = 'pending' WHERE role = 'awaiting_approval';

-- 5. Set role_level based on role
UPDATE users SET role_level = 
  CASE 
    WHEN role = 'admin' THEN 100
    WHEN role = 'manager' THEN 80
    WHEN role = 'coach' THEN 70
    WHEN role = 'analyst' THEN 60
    WHEN role = 'player' THEN 50
    WHEN role = 'pending' THEN 10
    ELSE 10
  END;

-- 6. Set default role for new users
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'pending';

-- 7. Create trigger to automatically set role_level when role is updated
CREATE OR REPLACE FUNCTION set_role_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.role_level := CASE 
    WHEN NEW.role = 'admin' THEN 100
    WHEN NEW.role = 'manager' THEN 80
    WHEN NEW.role = 'coach' THEN 70
    WHEN NEW.role = 'analyst' THEN 60
    WHEN NEW.role = 'player' THEN 50
    WHEN NEW.role = 'pending' THEN 10
    ELSE 10
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_role_level
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_role_level();

-- 8. Create function to get all users (for admin access)
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  role_level INTEGER,
  team_id UUID,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
) 
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.role_level,
    u.team_id,
    u.avatar_url,
    u.created_at
  FROM users u
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to update user role (admin only)
CREATE OR REPLACE FUNCTION update_user_role_admin(
  user_id UUID,
  new_role TEXT,
  admin_id UUID
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  role_level INTEGER,
  team_id UUID,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
) 
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = admin_id 
    AND users.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Validate new role
  IF new_role NOT IN ('admin', 'manager', 'coach', 'player', 'analyst', 'pending') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;
  
  -- Update the user's role
  UPDATE users 
  SET role = new_role
  WHERE users.id = user_id;
  
  -- Return updated user
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.role_level,
    u.team_id,
    u.avatar_url,
    u.created_at
  FROM users u
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- 10. Create RLS policies for secure access
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Public can insert users during signup" ON users;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read their own profile" ON users
FOR SELECT USING (auth.uid() = id);

-- Policy: Admins can read all users
CREATE POLICY "Admins can read all users" ON users
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy: Users can update their own profile (except role)
CREATE POLICY "Users can update their own profile" ON users
FOR UPDATE USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND (
    -- Users can update their own profile but not their role
    (OLD.role = NEW.role) 
    OR 
    -- Unless they're admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  )
);

-- Policy: Admins can update all users
CREATE POLICY "Admins can update all users" ON users
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy: Allow profile creation during signup
CREATE POLICY "Allow profile creation during signup" ON users
FOR INSERT WITH CHECK (
  auth.uid() = id 
  AND role = 'pending'
);

-- Policy: Admins can insert users
CREATE POLICY "Admins can insert users" ON users
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- 11. Create view for user management (optional)
CREATE OR REPLACE VIEW user_management_view AS
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.role_level,
  u.team_id,
  u.avatar_url,
  u.created_at,
  t.name as team_name
FROM users u
LEFT JOIN teams t ON u.team_id = t.id
ORDER BY u.created_at DESC;

-- 12. Grant necessary permissions
GRANT SELECT ON user_management_view TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_role_admin(UUID, TEXT, UUID) TO authenticated;

-- 13. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_role_level ON users(role_level);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);

-- Migration complete
-- You can now use the new role system with 'pending' as the default role
-- Admin users can manage roles through the admin interface
-- RLS policies ensure secure access based on roles

-- To create your first admin user, run:
-- INSERT INTO users (id, email, name, role, role_level) 
-- VALUES ('YOUR_USER_ID', 'your-email@example.com', 'Your Name', 'admin', 100);

-- Check current users and roles:
-- SELECT id, email, name, role, role_level FROM users ORDER BY created_at;