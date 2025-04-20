-- Add friendship functionality

-- Create friendships table
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

-- Enable RLS on friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Friendship policies
CREATE POLICY "Users can view their own friendships"
  ON friendships FOR SELECT
  USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR 
    friend_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending'
  );

CREATE POLICY "Users can update their own friendship status"
  ON friendships FOR UPDATE
  USING (
    friend_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending'
  );

-- Add columns for tracking round timing (if they don't exist)
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add function to send a friend request
CREATE OR REPLACE FUNCTION send_friend_request(friend_username TEXT)
RETURNS UUID AS $$
DECLARE
  current_user_profile_id UUID;
  friend_profile_id UUID;
  existing_friendship_id UUID;
  new_friendship_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Get the profile ID of the friend
  SELECT id INTO friend_profile_id FROM profiles 
  WHERE username = friend_username;
  
  IF friend_profile_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF friend_profile_id = current_user_profile_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;
  
  -- Check if there's already a friendship
  SELECT id INTO existing_friendship_id FROM friendships
  WHERE (user_id = current_user_profile_id AND friend_id = friend_profile_id)
     OR (user_id = friend_profile_id AND friend_id = current_user_profile_id);
     
  IF existing_friendship_id IS NOT NULL THEN
    RAISE EXCEPTION 'Friendship already exists';
  END IF;
  
  -- Create the friendship
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES (current_user_profile_id, friend_profile_id, 'pending')
  RETURNING id INTO new_friendship_id;
  
  RETURN new_friendship_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to accept a friend request
CREATE OR REPLACE FUNCTION accept_friend_request(friendship_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
  requesting_profile_id UUID;
  friendship_status TEXT;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Get the friendship and check it exists
  SELECT user_id, status INTO requesting_profile_id, friendship_status
  FROM friendships 
  WHERE id = friendship_id AND friend_id = current_user_profile_id;
  
  IF requesting_profile_id IS NULL THEN
    RAISE EXCEPTION 'Friendship not found or you are not the recipient';
  END IF;
  
  IF friendship_status != 'pending' THEN
    RAISE EXCEPTION 'Friendship is not pending';
  END IF;
  
  -- Update the friendship
  UPDATE friendships
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = friendship_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to reject a friend request
CREATE OR REPLACE FUNCTION reject_friend_request(friendship_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
  requesting_profile_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Get the friendship and check it exists
  SELECT user_id INTO requesting_profile_id
  FROM friendships 
  WHERE id = friendship_id AND friend_id = current_user_profile_id;
  
  IF requesting_profile_id IS NULL THEN
    RAISE EXCEPTION 'Friendship not found or you are not the recipient';
  END IF;
  
  -- Update the friendship
  UPDATE friendships
  SET status = 'rejected',
      updated_at = NOW()
  WHERE id = friendship_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get all friends
CREATE OR REPLACE FUNCTION get_friends()
RETURNS JSONB AS $$
DECLARE
  current_user_profile_id UUID;
  result JSONB;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  SELECT jsonb_build_object(
    'friends', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'friendship_id', f.id,
        'friendship_status', f.status
      ))
      FROM friendships f
      JOIN profiles p ON (
        CASE 
          WHEN f.user_id = current_user_profile_id THEN p.id = f.friend_id
          WHEN f.friend_id = current_user_profile_id THEN p.id = f.user_id
        END
      )
      WHERE (f.user_id = current_user_profile_id OR f.friend_id = current_user_profile_id)
      AND f.status = 'accepted'
    ),
    'pending_sent', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'friendship_id', f.id
      ))
      FROM friendships f
      JOIN profiles p ON p.id = f.friend_id
      WHERE f.user_id = current_user_profile_id
      AND f.status = 'pending'
    ),
    'pending_received', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'friendship_id', f.id
      ))
      FROM friendships f
      JOIN profiles p ON p.id = f.user_id
      WHERE f.friend_id = current_user_profile_id
      AND f.status = 'pending'
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to create a game with friends
CREATE OR REPLACE FUNCTION create_game_with_friends(
  game_name TEXT,
  max_players INTEGER,
  max_rounds INTEGER,
  friend_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  current_user_profile_id UUID;
  new_game_id UUID;
  friend_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Validate max_players
  IF max_players < 2 OR max_players > 10 THEN
    max_players := 6; -- Default to 6 if invalid
  END IF;
  
  -- Validate max_rounds
  IF max_rounds < 5 OR max_rounds > 15 THEN
    max_rounds := 10; -- Default to 10 if invalid
  END IF;
  
  -- Create the game
  INSERT INTO games (name, created_by, max_players, max_rounds)
  VALUES (game_name, current_user_profile_id, max_players, max_rounds)
  RETURNING id INTO new_game_id;
  
  -- Add the creator as a participant
  INSERT INTO game_participants (game_id, profile_id)
  VALUES (new_game_id, current_user_profile_id);
  
  -- Add friends as participants
  FOREACH friend_id IN ARRAY friend_ids
  LOOP
    -- Verify this is a valid friend
    IF EXISTS (
      SELECT 1 FROM friendships f
      WHERE ((f.user_id = current_user_profile_id AND f.friend_id = friend_id)
         OR (f.user_id = friend_id AND f.friend_id = current_user_profile_id))
      AND f.status = 'accepted'
    ) THEN
      -- Add friend as participant
      INSERT INTO game_participants (game_id, profile_id)
      VALUES (new_game_id, friend_id);
    END IF;
  END LOOP;
  
  RETURN new_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modified function to start a round with timing
CREATE OR REPLACE FUNCTION start_round(round_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE rounds
  SET start_time = NOW()
  WHERE id = round_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for friendships
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id); 