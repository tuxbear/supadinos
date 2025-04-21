-- Fix ambiguous game_id reference in start_game function
CREATE OR REPLACE FUNCTION start_game(game_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  creator_profile_id UUID;
  current_user_profile_id UUID;
  current_players INTEGER;
  min_players INTEGER := 2;
  found_game_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Check if the game exists and user is the creator
  SELECT id, created_by INTO found_game_id, creator_profile_id 
  FROM games 
  WHERE id = game_uuid;
  
  IF found_game_id IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  
  IF creator_profile_id != current_user_profile_id THEN
    RAISE EXCEPTION 'Only the game creator can start the game';
  END IF;
  
  -- Check if there are enough players
  SELECT COUNT(*) INTO current_players 
  FROM game_participants 
  WHERE game_id = game_uuid;
  
  IF current_players < min_players THEN
    RAISE EXCEPTION 'Not enough players to start the game (minimum: %)', min_players;
  END IF;
  
  -- Update game status to active
  UPDATE games SET 
    status = 'active',
    updated_at = NOW()
  WHERE id = game_uuid;
  
  -- Create first round
  PERFORM create_new_round(game_uuid, 1);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 