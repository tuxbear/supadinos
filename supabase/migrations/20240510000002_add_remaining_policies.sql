-- Add remaining Row Level Security policies

-- Game participants policies
CREATE POLICY "Participants are viewable by users in the same game"
  ON game_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants my_participation
      JOIN profiles p ON p.id = my_participation.profile_id
      WHERE my_participation.game_id = game_participants.game_id
      AND p.user_id = auth.uid()
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

-- Board configurations policies
CREATE POLICY "Board configurations are viewable by game participants"
  ON board_configurations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants
      JOIN profiles ON profiles.id = game_participants.profile_id
      WHERE game_participants.game_id = board_configurations.game_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Robots policies
CREATE POLICY "Robots are viewable by game participants"
  ON robots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_configurations bc
      JOIN game_participants gp ON gp.game_id = bc.game_id
      JOIN profiles p ON p.id = gp.profile_id
      WHERE bc.id = robots.board_id
      AND p.user_id = auth.uid()
    )
  );

-- Targets policies
CREATE POLICY "Targets are viewable by game participants"
  ON targets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_configurations bc
      JOIN game_participants gp ON gp.game_id = bc.game_id
      JOIN profiles p ON p.id = gp.profile_id
      WHERE bc.id = targets.board_id
      AND p.user_id = auth.uid()
    )
  );

-- Walls policies
CREATE POLICY "Walls are viewable by game participants"
  ON walls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_configurations bc
      JOIN game_participants gp ON gp.game_id = bc.game_id
      JOIN profiles p ON p.id = gp.profile_id
      WHERE bc.id = walls.board_id
      AND p.user_id = auth.uid()
    )
  );

-- Rounds policies
CREATE POLICY "Rounds are viewable by game participants"
  ON rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants gp
      JOIN profiles p ON p.id = gp.profile_id
      WHERE gp.game_id = rounds.game_id
      AND p.user_id = auth.uid()
    )
  );

-- Moves policies
CREATE POLICY "Moves are viewable by game participants"
  ON moves FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds r
      JOIN game_participants gp ON gp.game_id = r.game_id
      JOIN profiles p ON p.id = gp.profile_id
      WHERE r.id = moves.round_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can submit their own moves"
  ON moves FOR INSERT
  WITH CHECK (
    participant_id IN (
      SELECT gp.id 
      FROM game_participants gp
      JOIN profiles p ON p.id = gp.profile_id
      WHERE p.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM rounds r
      WHERE r.id = moves.round_id
      AND r.completed_at IS NULL
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_game_participants_game_id ON game_participants(game_id);
CREATE INDEX idx_game_participants_profile_id ON game_participants(profile_id);
CREATE INDEX idx_board_configurations_game_id ON board_configurations(game_id);
CREATE INDEX idx_robots_board_id ON robots(board_id);
CREATE INDEX idx_targets_board_id ON targets(board_id);
CREATE INDEX idx_walls_board_id ON walls(board_id);
CREATE INDEX idx_rounds_game_id ON rounds(game_id);
CREATE INDEX idx_rounds_board_config_id ON rounds(board_config_id);
CREATE INDEX idx_moves_round_id ON moves(round_id);
CREATE INDEX idx_moves_participant_id ON moves(participant_id); 