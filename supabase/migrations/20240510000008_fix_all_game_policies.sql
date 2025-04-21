-- Drop all existing game-related policies
DROP POLICY IF EXISTS "Games are viewable by participants" ON games;
DROP POLICY IF EXISTS "Users can create games" ON games;
DROP POLICY IF EXISTS "Game creator can update game" ON games;
DROP POLICY IF EXISTS "Participants are viewable by game creators" ON game_participants;
DROP POLICY IF EXISTS "Participants can view their own games" ON game_participants;
DROP POLICY IF EXISTS "Users can join games" ON game_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON game_participants;

-- Create new simplified policies for games
CREATE POLICY "Games are viewable by creators"
  ON games FOR SELECT
  USING (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Games are viewable by participants"
  ON games FOR SELECT
  USING (
    id IN (
      SELECT game_id FROM game_participants
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Games in waiting status are viewable"
  ON games FOR SELECT
  USING (status = 'waiting');

CREATE POLICY "Users can create games"
  ON games FOR INSERT
  WITH CHECK (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Game creator can update game"
  ON games FOR UPDATE
  USING (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Create new simplified policies for game_participants
CREATE POLICY "Participants can view all participants in their games"
  ON game_participants FOR SELECT
  USING (
    game_id IN (
      SELECT game_id FROM game_participants
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can join games"
  ON game_participants FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participation"
  ON game_participants FOR UPDATE
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ); 