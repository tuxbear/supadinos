-- Add notifications functionality

-- Create notification types enum
CREATE TYPE notification_type AS ENUM (
  'new_game',
  'moves_submitted',
  'round_over',
  'game_over'
);

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_game_id ON notifications(game_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Set up RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Policy to allow users to mark their own notifications as read
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Function to create notification for a single user
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_message TEXT,
  p_game_id UUID DEFAULT NULL,
  p_round_id UUID DEFAULT NULL,
  p_sender_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    game_id,
    round_id,
    sender_id,
    message
  )
  VALUES (
    p_user_id,
    p_type,
    p_game_id,
    p_round_id,
    p_sender_id,
    p_message
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify all game participants
CREATE OR REPLACE FUNCTION notify_game_participants(
  p_game_id UUID,
  p_type notification_type,
  p_message TEXT,
  p_round_id UUID DEFAULT NULL,
  p_sender_id UUID DEFAULT NULL,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS SETOF UUID AS $$
DECLARE
  participant_id UUID;
BEGIN
  FOR participant_id IN 
    SELECT profile_id FROM game_participants 
    WHERE game_id = p_game_id
    AND (p_exclude_user_id IS NULL OR profile_id != p_exclude_user_id)
  LOOP
    RETURN NEXT create_notification(
      participant_id,
      p_type,
      p_message,
      p_game_id,
      p_round_id,
      p_sender_id
    );
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_as_read(notification_ids UUID[])
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Mark notifications as read
  UPDATE notifications
  SET is_read = TRUE
  WHERE id = ANY(notification_ids)
  AND user_id = current_user_profile_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to generate notifications automatically

-- 1. New game created
CREATE OR REPLACE FUNCTION notify_new_game()
RETURNS TRIGGER AS $$
DECLARE
  creator_name TEXT;
  game_participant_id UUID;
BEGIN
  -- Get creator's username
  SELECT username INTO creator_name FROM profiles WHERE id = NEW.created_by;
  
  -- Only notify other players (not the creator)
  FOR game_participant_id IN 
    SELECT profile_id FROM game_participants 
    WHERE game_id = NEW.id
    AND profile_id != NEW.created_by
  LOOP
    PERFORM create_notification(
      game_participant_id,
      'new_game',
      creator_name || ' invited you to play "' || NEW.name || '"',
      NEW.id,
      NULL,
      NEW.created_by
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_on_game_creation
AFTER INSERT ON games
FOR EACH ROW
EXECUTE FUNCTION notify_new_game();

-- 2. Player moves submitted
CREATE OR REPLACE FUNCTION notify_moves_submitted()
RETURNS TRIGGER AS $$
DECLARE
  game_id UUID;
  round_number INTEGER;
  submitter_name TEXT;
  move_count INTEGER;
BEGIN
  -- Only create notification for the first move of each participant-round combination
  IF NEW.move_number = 1 THEN
    -- Get game ID and round number
    SELECT r.game_id, r.round_number INTO game_id, round_number
    FROM rounds r
    WHERE r.id = NEW.round_id;
    
    -- Get submitter's username
    SELECT p.username INTO submitter_name
    FROM profiles p
    JOIN game_participants gp ON p.id = gp.profile_id
    WHERE gp.id = NEW.participant_id;
    
    -- Count total moves for this participant in this round
    SELECT COUNT(*) INTO move_count
    FROM moves
    WHERE round_id = NEW.round_id
    AND participant_id = NEW.participant_id;
    
    -- Notify all participants except the submitter
    PERFORM notify_game_participants(
      game_id,
      'moves_submitted',
      submitter_name || ' submitted their solution for Round ' || round_number || ' in ' || move_count || ' moves',
      NEW.round_id,
      (SELECT profile_id FROM game_participants WHERE id = NEW.participant_id),
      (SELECT profile_id FROM game_participants WHERE id = NEW.participant_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_on_moves_submission
AFTER INSERT ON moves
FOR EACH ROW
EXECUTE FUNCTION notify_moves_submitted();

-- 3. Round over
CREATE OR REPLACE FUNCTION notify_round_over()
RETURNS TRIGGER AS $$
DECLARE
  winner_name TEXT;
  game_name TEXT;
  winner_profile_id UUID;
BEGIN
  -- Only trigger when completed_at changes from NULL to non-NULL
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    -- Get winner info
    SELECT p.username, gp.profile_id INTO winner_name, winner_profile_id
    FROM profiles p
    JOIN game_participants gp ON p.id = gp.profile_id
    WHERE gp.id = NEW.winner_id;
    
    -- Get game name
    SELECT name INTO game_name FROM games WHERE id = NEW.game_id;
    
    -- Notify all participants
    PERFORM notify_game_participants(
      NEW.game_id,
      'round_over',
      'Round ' || NEW.round_number || ' in "' || game_name || '" is complete. Winner: ' || 
      COALESCE(winner_name, 'No winner') || ' with ' || COALESCE(NEW.winning_moves::text, '0') || ' moves',
      NEW.id,
      winner_profile_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_on_round_completion
AFTER UPDATE ON rounds
FOR EACH ROW
EXECUTE FUNCTION notify_round_over();

-- 4. Game over
CREATE OR REPLACE FUNCTION notify_game_over()
RETURNS TRIGGER AS $$
DECLARE
  winner_id UUID;
  winner_name TEXT;
  winner_score INTEGER;
  winner_profile_id UUID;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Find the winner (highest score)
    SELECT gp.id, p.username, gp.score, gp.profile_id 
    INTO winner_id, winner_name, winner_score, winner_profile_id
    FROM game_participants gp
    JOIN profiles p ON gp.profile_id = p.id
    WHERE gp.game_id = NEW.id
    ORDER BY gp.score DESC
    LIMIT 1;
    
    -- Notify all participants
    PERFORM notify_game_participants(
      NEW.id,
      'game_over',
      'Game "' || NEW.name || '" is now complete. Winner: ' || 
      COALESCE(winner_name, 'No winner') || ' with ' || COALESCE(winner_score::text, '0') || ' points',
      NULL,
      winner_profile_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_on_game_completion
AFTER UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION notify_game_over(); 