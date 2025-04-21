-- Add chat functionality to games

-- Create game_messages table
CREATE TABLE game_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(message) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_game_messages_game_id ON game_messages(game_id);
CREATE INDEX idx_game_messages_created_at ON game_messages(created_at);

-- Set up RLS policies
ALTER TABLE game_messages ENABLE ROW LEVEL SECURITY;

-- Policy to allow only game participants to see game messages
CREATE POLICY "Game participants can view messages"
  ON game_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants gp
      WHERE gp.game_id = game_messages.game_id
      AND gp.profile_id = auth.uid()
    )
  );

-- Policy to allow only game participants to insert messages
CREATE POLICY "Game participants can send messages"
  ON game_messages
  FOR INSERT
  WITH CHECK (
    sender_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND
    EXISTS (
      SELECT 1 FROM game_participants gp
      WHERE gp.game_id = game_messages.game_id
      AND gp.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Function to send a game message
CREATE OR REPLACE FUNCTION send_game_message(game_uuid UUID, message_text TEXT)
RETURNS UUID AS $$
DECLARE
  current_user_profile_id UUID;
  message_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Verify user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM game_participants 
    WHERE game_id = game_uuid 
    AND profile_id = current_user_profile_id
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this game';
  END IF;
  
  -- Check message length
  IF length(message_text) > 1000 THEN
    RAISE EXCEPTION 'Message cannot exceed 1000 characters';
  END IF;
  
  -- Insert the message
  INSERT INTO game_messages (game_id, sender_id, message)
  VALUES (game_uuid, current_user_profile_id, message_text)
  RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 