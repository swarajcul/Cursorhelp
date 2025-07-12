-- Insert sample teams
INSERT INTO teams (id, name) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Raptor Alpha'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Raptor Beta')
ON CONFLICT (id) DO NOTHING;

-- Note: The admin user will be created through the auth system
-- This is just for reference of the test user credentials:
-- Email: admin@raptoresports.gg
-- Password: Test@12345
-- Role: admin

-- Insert sample users (these will be created after auth signup)
-- This is a placeholder for the user profiles that will be created
