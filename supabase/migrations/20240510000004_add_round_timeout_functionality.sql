-- Add round timeout functionality and update scoring system

-- Add columns for tracking round timing and outcomes
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER DEFAULT 300; -- 5 minutes default
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS all_players_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE game_participants ADD COLUMN IF NOT EXISTS time_spent_seconds NUMERIC DEFAULT 0;

-- Function to start a round with timing for a specific player
CREATE OR REPLACE FUNCTION start_player_round(round_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
  participant_id UUID;
  participant_exists BOOLEAN;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Get the participant ID for this user in this round's game
  SELECT gp.id, (COUNT(*) > 0) INTO participant_id, participant_exists
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
  VALUES (round_id, participant_id, NOW())
  ON CONFLICT (round_id, participant_id) 
  DO UPDATE SET 
    start_time = NOW(),
    end_time = NULL, 
    has_forfeit = FALSE;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a new table to track each participant's round performance
CREATE TABLE IF NOT EXISTS round_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES game_participants(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  time_spent_seconds NUMERIC,
  moves_count INTEGER,
  has_forfeit BOOLEAN DEFAULT FALSE,
  UNIQUE (round_id, participant_id)
);

-- Enable RLS on round_participants if the table was just created
ALTER TABLE round_participants ENABLE ROW LEVEL SECURITY;

-- Create policy only if it doesn't exist already (using DO block with exception handling)
DO $$
BEGIN
  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'round_participants' 
    AND policyname = 'Round participants are viewable by game participants'
  ) THEN
    -- Create the policy if it doesn't exist
    CREATE POLICY "Round participants are viewable by game participants"
      ON round_participants FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM rounds r
          JOIN game_participants gp ON gp.game_id = r.game_id
          JOIN profiles p ON p.id = gp.profile_id
          WHERE r.id = round_participants.round_id
          AND p.user_id = auth.uid()
        )
      );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Do nothing if policy already exists
END$$;

-- Function to forfeit a round for the current player
CREATE OR REPLACE FUNCTION forfeit_round(round_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
  participant_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Get the participant ID for this user
  SELECT gp.id INTO participant_id
  FROM game_participants gp
  JOIN rounds r ON r.game_id = gp.game_id
  WHERE r.id = round_id
  AND gp.profile_id = current_user_profile_id;
  
  IF participant_id IS NULL THEN
    RAISE EXCEPTION 'User is not a participant in this round';
  END IF;
  
  -- Mark the round as forfeit for this participant
  UPDATE round_participants
  SET 
    has_forfeit = TRUE,
    end_time = NOW(),
    time_spent_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))
  WHERE round_id = round_id AND participant_id = participant_id;
  
  -- Check if all players have completed the round
  PERFORM check_round_completion(round_id);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a round is timed out
CREATE OR REPLACE FUNCTION check_round_timeout()
RETURNS TRIGGER AS $$
DECLARE
  time_limit INTEGER;
  time_elapsed NUMERIC;
BEGIN
  -- Get the time limit for this round
  SELECT time_limit_seconds INTO time_limit 
  FROM rounds WHERE id = NEW.round_id;
  
  -- Calculate time elapsed
  time_elapsed := EXTRACT(EPOCH FROM (NOW() - NEW.start_time));
  
  -- If time elapsed is greater than the time limit, mark as forfeit
  IF time_elapsed > time_limit THEN
    UPDATE round_participants
    SET 
      has_forfeit = TRUE,
      end_time = NEW.start_time + (time_limit * INTERVAL '1 second'),
      time_spent_seconds = time_limit
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to check for timeout when a round_participant is updated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'check_round_timeout_trigger'
  ) THEN
    CREATE TRIGGER check_round_timeout_trigger
    AFTER UPDATE ON round_participants
    FOR EACH ROW
    WHEN (NEW.end_time IS NULL AND NEW.has_forfeit = FALSE)
    EXECUTE FUNCTION check_round_timeout();
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Do nothing if trigger already exists
END$$;

-- Modified function to submit a solution for a round
CREATE OR REPLACE FUNCTION submit_solution(
  round_uuid UUID, 
  moves_json JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  game_id UUID;
  current_user_profile_id UUID;
  participant_id UUID;
  round_number INTEGER;
  max_rounds INTEGER;
  move_count INTEGER;
  start_time TIMESTAMP WITH TIME ZONE;
  time_spent NUMERIC;
  is_valid BOOLEAN;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Get the game id and round number
  SELECT rounds.game_id, rounds.round_number INTO game_id, round_number
  FROM rounds
  WHERE rounds.id = round_uuid;
  
  -- Check if the user is a participant
  SELECT id INTO participant_id 
  FROM game_participants 
  WHERE game_id = game_id AND profile_id = current_user_profile_id;
  
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

-- Function to check if all players have completed a round and determine winner
CREATE OR REPLACE FUNCTION check_round_completion(round_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  game_uuid UUID;
  total_participants INTEGER;
  completed_participants INTEGER;
  next_round_number INTEGER;
  min_moves INTEGER;
  winning_participant_id UUID;
  round_number INTEGER;
  max_rounds INTEGER;
BEGIN
  -- Get the game ID for this round
  SELECT game_id, round_number INTO game_uuid, round_number
  FROM rounds
  WHERE id = round_id;
  
  -- Count total participants in the game
  SELECT COUNT(*) INTO total_participants
  FROM game_participants
  WHERE game_id = game_uuid;
  
  -- Count participants who have completed this round (either with a solution or forfeit)
  SELECT COUNT(*) INTO completed_participants
  FROM round_participants rp
  WHERE round_id = round_id AND (end_time IS NOT NULL OR has_forfeit = TRUE);
  
  -- If all participants have completed the round
  IF completed_participants >= total_participants THEN
    -- Mark the round as completed
    UPDATE rounds
    SET all_players_completed = TRUE
    WHERE id = round_id;
    
    -- Find the participant with the fewest moves who hasn't forfeit
    SELECT rp.participant_id INTO winning_participant_id
    FROM round_participants rp
    WHERE rp.round_id = round_id
    AND rp.has_forfeit = FALSE
    ORDER BY rp.moves_count ASC, rp.time_spent_seconds ASC
    LIMIT 1;
    
    -- If there's a winner (at least one player completed without forfeiting)
    IF winning_participant_id IS NOT NULL THEN
      -- Get the winner's move count
      SELECT rp.moves_count INTO min_moves
      FROM round_participants rp
      WHERE rp.round_id = round_id AND rp.participant_id = winning_participant_id;
      
      -- Update the round with the winner
      UPDATE rounds
      SET winner_id = winning_participant_id,
          winning_moves = min_moves,
          completed_at = NOW()
      WHERE id = round_id;
      
      -- Update the winner's score
      UPDATE game_participants
      SET score = score + 1
      WHERE id = winning_participant_id;
    ELSE
      -- If everyone forfeit, just mark the round as completed
      UPDATE rounds
      SET completed_at = NOW()
      WHERE id = round_id;
    END IF;
    
    -- Check if this was the last round
    SELECT max_rounds INTO max_rounds FROM games WHERE id = game_uuid;
    
    IF round_number >= max_rounds THEN
      -- End the game
      UPDATE games
      SET status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = game_uuid;
    ELSE
      -- Create the next round
      next_round_number := round_number + 1;
      PERFORM create_new_round(game_uuid, next_round_number);
    END IF;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set up periodic checking for timed out rounds
CREATE OR REPLACE FUNCTION setup_round_timeout_checking()
RETURNS VOID AS $$
BEGIN
  -- This would be implemented with a scheduled job or external service
  -- For PostgreSQL, you can use pg_cron extension for scheduling
  -- Example: SELECT cron.schedule('* * * * *', 'SELECT check_all_round_timeouts()');
  
  -- For now, we'll rely on client-side timing and triggering the forfeit function
  -- when the time is up, but in a production environment, you would use a scheduled job
  
  RETURN;
END;
$$ LANGUAGE plpgsql; 