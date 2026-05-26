-- Fix all ambiguous column references in game functions

-- Override the submit_solution function to fix all ambiguous references
CREATE OR REPLACE FUNCTION submit_solution(round_id UUID, moves_json JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
  participant_var UUID;  -- Renamed from participant_id to avoid ambiguity
  game_var UUID;        -- Renamed from game_id to avoid ambiguity
  round_number INTEGER;
  move_count INTEGER;
  is_valid BOOLEAN;
  start_time TIMESTAMP WITH TIME ZONE;
  time_spent NUMERIC;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Get the game id and round number
  SELECT rounds.game_id, rounds.round_number INTO game_var, round_number
  FROM rounds
  WHERE rounds.id = round_id;
  
  -- Check if the user is a participant
  SELECT id INTO participant_var 
  FROM game_participants 
  WHERE game_id = game_var AND profile_id = current_user_profile_id;
  
  IF participant_var IS NULL THEN
    RAISE EXCEPTION 'User is not a participant in this game';
  END IF;
  
  -- Get the start time for this participant's round
  SELECT rp.start_time INTO start_time
  FROM round_participants rp
  WHERE rp.round_id = round_id AND rp.participant_id = participant_var;
  
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
        round_id,
        participant_var,
        moves_json->i->>'color',
        i + 1,
        (moves_json->i->>'from_x')::INTEGER,
        (moves_json->i->>'from_y')::INTEGER,
        (moves_json->i->>'to_x')::INTEGER,
        (moves_json->i->>'to_y')::INTEGER
      );
    END LOOP;
    
    -- Update round participant record
    UPDATE round_participants rp
    SET 
      end_time = NOW(),
      time_spent_seconds = time_spent,
      moves_count = move_count,
      has_forfeit = FALSE
    WHERE rp.round_id = round_id AND rp.participant_id = participant_var;
    
    -- Check if all players have completed the round
    PERFORM check_round_completion(round_id);
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the check_round_completion function to avoid ambiguous references
CREATE OR REPLACE FUNCTION check_round_completion(round_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  game_var UUID;  -- Renamed from game_id to avoid ambiguity
  total_participants INTEGER;
  completed_participants INTEGER;
  next_round_number INTEGER;
  min_moves INTEGER;
  winning_participant_var UUID;  -- Renamed from winning_participant_id
  round_num INTEGER;  -- Renamed to avoid confusion with parameter
  max_rounds INTEGER;
BEGIN
  -- Get the game ID for this round
  SELECT game_id, round_number INTO game_var, round_num
  FROM rounds
  WHERE id = round_id;
  
  -- Count total participants in the game
  SELECT COUNT(*) INTO total_participants
  FROM game_participants
  WHERE game_id = game_var;
  
  -- Count participants who have completed this round (either with a solution or forfeit)
  SELECT COUNT(*) INTO completed_participants
  FROM round_participants rp
  WHERE rp.round_id = round_id AND (rp.end_time IS NOT NULL OR rp.has_forfeit = TRUE);
  
  -- If all participants have completed the round
  IF completed_participants >= total_participants THEN
    -- Mark the round as completed
    UPDATE rounds
    SET all_players_completed = TRUE
    WHERE id = round_id;
    
    -- Find the participant with the fewest moves who hasn't forfeit
    SELECT rp.participant_id INTO winning_participant_var
    FROM round_participants rp
    WHERE rp.round_id = round_id
    AND rp.has_forfeit = FALSE
    ORDER BY rp.moves_count ASC, rp.time_spent_seconds ASC
    LIMIT 1;
    
    -- If there's a winner (at least one player completed without forfeiting)
    IF winning_participant_var IS NOT NULL THEN
      -- Get the winner's move count
      SELECT rp.moves_count INTO min_moves
      FROM round_participants rp
      WHERE rp.round_id = round_id AND rp.participant_id = winning_participant_var;
      
      -- Update the round with the winner
      UPDATE rounds
      SET winner_id = winning_participant_var,
          winning_moves = min_moves,
          completed_at = NOW()
      WHERE id = round_id;
      
      -- Update the winner's score
      UPDATE game_participants
      SET score = score + 1
      WHERE id = winning_participant_var;
    ELSE
      -- If everyone forfeit, just mark the round as completed
      UPDATE rounds
      SET completed_at = NOW()
      WHERE id = round_id;
    END IF;
    
    -- Check if this was the last round
    SELECT max_rounds INTO max_rounds FROM games WHERE id = game_var;
    
    IF round_num >= max_rounds THEN
      -- End the game
      UPDATE games
      SET status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = game_var;
    ELSE
      -- Create the next round
      next_round_number := round_num + 1;
      PERFORM create_new_round(game_var, next_round_number);
    END IF;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the start_player_round function to avoid ambiguous references
CREATE OR REPLACE FUNCTION start_player_round(round_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
  participant_var UUID;  -- Renamed from participant_id
  participant_exists BOOLEAN;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Get the participant ID for this user in this round's game
  SELECT gp.id, (COUNT(*) > 0) INTO participant_var, participant_exists
  FROM rounds r
  JOIN game_participants gp ON gp.game_id = r.game_id
  WHERE r.id = round_id
  AND gp.profile_id = current_user_profile_id
  GROUP BY gp.id
  LIMIT 1;
  
  IF NOT participant_exists THEN
    RAISE EXCEPTION 'User is not a participant in this game';
  END IF;
  
  -- Record the start time for this participant in this round
  INSERT INTO round_participants (round_id, participant_id, start_time)
  VALUES (round_id, participant_var, NOW())
  ON CONFLICT (round_id, participant_id) 
  DO UPDATE SET 
    start_time = NOW(),
    end_time = NULL, 
    has_forfeit = FALSE;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the forfeit_round function to avoid ambiguous references
CREATE OR REPLACE FUNCTION forfeit_round(round_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
  participant_var UUID;  -- Renamed from participant_id
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Get the participant ID for this user
  SELECT gp.id INTO participant_var
  FROM game_participants gp
  JOIN rounds r ON r.game_id = gp.game_id
  WHERE r.id = round_id
  AND gp.profile_id = current_user_profile_id;
  
  IF participant_var IS NULL THEN
    RAISE EXCEPTION 'User is not a participant in this round';
  END IF;
  
  -- Mark the round as forfeit for this participant
  UPDATE round_participants rp
  SET 
    has_forfeit = TRUE,
    end_time = NOW(),
    time_spent_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))
  WHERE rp.round_id = round_id AND rp.participant_id = participant_var;
  
  -- Check if all players have completed the round
  PERFORM check_round_completion(round_id);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 