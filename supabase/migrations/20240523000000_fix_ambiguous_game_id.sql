-- Fix ambiguous game_id column reference in submit_solution function

-- Override the existing submit_solution function with a fixed version
CREATE OR REPLACE FUNCTION submit_solution(round_uuid UUID, moves_json JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
  participant_id UUID;
  game_uuid UUID;  -- Renamed from game_id to avoid ambiguity
  round_number INTEGER;
  move_count INTEGER;
  is_valid BOOLEAN;
  start_time TIMESTAMP WITH TIME ZONE;
  time_spent NUMERIC;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Get the game id and round number
  SELECT rounds.game_id, rounds.round_number INTO game_uuid, round_number
  FROM rounds
  WHERE rounds.id = round_uuid;
  
  -- Check if the user is a participant
  SELECT id INTO participant_id 
  FROM game_participants 
  WHERE game_id = game_uuid AND profile_id = current_user_profile_id;
  
  IF participant_id IS NULL THEN
    RAISE EXCEPTION 'User is not a participant in this game';
  END IF;
  
  -- Get the start time for this participant's round
  SELECT rp.start_time INTO start_time
  FROM round_participants rp
  WHERE rp.round_id = round_uuid AND rp.participant_id = participant_id;
  
  IF start_time IS NULL THEN
    RAISE EXCEPTION 'Round has not been started for this participant';
  END IF;
  
  -- Calculate time spent
  time_spent := EXTRACT(EPOCH FROM (NOW() - start_time));
  
  -- Count the number of moves
  move_count := jsonb_array_length(moves_json);
  
  -- In a real implementation, you would validate the moves here
  is_valid := TRUE;
  
  IF is_valid THEN
    -- Record the moves
    FOR i IN 0..move_count-1 LOOP
      INSERT INTO moves (
        round_id, 
        participant_id, 
        robot_color,
        move_number,
        from_x,
        from_y,
        to_x,
        to_y
      )
      VALUES (
        round_uuid,
        participant_id,
        moves_json->i->>'color',
        i + 1,
        (moves_json->i->>'from_x')::INTEGER,
        (moves_json->i->>'from_y')::INTEGER,
        (moves_json->i->>'to_x')::INTEGER,
        (moves_json->i->>'to_y')::INTEGER
      );
    END LOOP;
    
    -- Update round participant record
    UPDATE round_participants
    SET 
      end_time = NOW(),
      time_spent_seconds = time_spent,
      moves_count = move_count,
      has_forfeit = FALSE
    WHERE round_id = round_uuid AND participant_id = participant_id;
    
    -- Check if all players have completed the round
    PERFORM check_round_completion(round_uuid);
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 