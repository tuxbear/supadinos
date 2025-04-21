-- Drop existing policies on game_participants
DROP POLICY IF EXISTS "Participants are viewable by users in the same game" ON game_participants;
DROP POLICY IF EXISTS "Users can join games" ON game_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON game_participants;

-- Create new non-recursive policies
CREATE POLICY "Participants are viewable by game creators"
  ON game_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_participants.game_id
      AND games.created_by IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Participants can view their own games"
  ON game_participants FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join games"
  ON game_participants FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_participants.game_id
      AND games.status = 'waiting'
    )
  );

CREATE POLICY "Users can update their own participation"
  ON game_participants FOR UPDATE
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ); 