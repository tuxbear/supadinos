-- First, attempt to drop all existing policies on game_participants
DROP POLICY IF EXISTS "Participants can view all participants in their games" ON game_participants;
DROP POLICY IF EXISTS "Users can join games" ON game_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON game_participants;
DROP POLICY IF EXISTS "Participants are viewable by users in the same game" ON game_participants;

-- List and drop all policies on game_participants to ensure we don't miss any
DO $$
DECLARE
    pol_record RECORD;
BEGIN
    FOR pol_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'game_participants'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON game_participants', pol_record.policyname);
    END LOOP;
END
$$;

-- Create extremely simplified policies that avoid recursion
CREATE POLICY "Anyone can select game_participants"
  ON game_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join games as themselves"
  ON game_participants FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update only their own score"
  ON game_participants FOR UPDATE
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ); 