-- Add push tokens support for mobile notifications

-- Add push_token column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Function to send push notification to a user
CREATE OR REPLACE FUNCTION send_push_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_push_token TEXT;
BEGIN
  -- Get user's push token
  SELECT push_token INTO v_push_token
  FROM profiles
  WHERE id = p_user_id;
  
  -- If user has a push token, send notification
  -- Note: In a real production app, you would call an external push notification
  -- service here like Firebase Cloud Messaging, OneSignal or Expo Push API
  -- For this example, we'll just log the intention to send a notification
  IF v_push_token IS NOT NULL AND v_push_token != '' THEN
    -- In production, replace this with actual push notification logic
    RAISE NOTICE 'Sending push notification to token %: %', v_push_token, p_title;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modify the create_notification function to also send push notifications
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
  push_title TEXT;
BEGIN
  -- Insert notification into database
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
  
  -- Determine push notification title based on type
  CASE p_type
    WHEN 'new_game' THEN push_title := 'New Game Invitation';
    WHEN 'moves_submitted' THEN push_title := 'Player Submitted Moves';
    WHEN 'round_over' THEN push_title := 'Round Completed';
    WHEN 'game_over' THEN push_title := 'Game Completed';
    ELSE push_title := 'Dinos Game Notification';
  END CASE;
  
  -- Send push notification
  PERFORM send_push_notification(
    p_user_id,
    push_title,
    p_message,
    jsonb_build_object(
      'notificationId', notification_id,
      'type', p_type,
      'gameId', p_game_id,
      'roundId', p_round_id
    )
  );
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 