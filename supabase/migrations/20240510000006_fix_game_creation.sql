-- Function to create a game with friends
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