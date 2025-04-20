-- Functions for game operations

-- Function to join a game
CREATE OR REPLACE FUNCTION join_game(game_uuid UUID)
RETURNS UUID AS $$
DECLARE
  profile_id UUID;
  game_status game_status;
  current_players INTEGER;
  max_players INTEGER;
  participant_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Check if the game exists and is in waiting status
  SELECT status, max_players INTO game_status, max_players 
  FROM games WHERE id = game_uuid;
  
  IF game_status != 'waiting' THEN
    RAISE EXCEPTION 'Cannot join game that is not in waiting status';
  END IF;
  
  -- Check if the game is full
  SELECT COUNT(*) INTO current_players 
  FROM game_participants WHERE game_id = game_uuid;
  
  IF current_players >= max_players THEN
    RAISE EXCEPTION 'Game is full';
  END IF;
  
  -- Check if the user is already a participant
  SELECT id INTO participant_id 
  FROM game_participants 
  WHERE game_id = game_uuid AND profile_id = profile_id;
  
  IF participant_id IS NOT NULL THEN
    RETURN participant_id;
  END IF;
  
  -- Add the user as a participant
  INSERT INTO game_participants (game_id, profile_id)
  VALUES (game_uuid, profile_id)
  RETURNING id INTO participant_id;
  
  RETURN participant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start a game
CREATE OR REPLACE FUNCTION start_game(game_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  creator_profile_id UUID;
  current_user_profile_id UUID;
  current_players INTEGER;
  min_players INTEGER := 2;
  game_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Check if the game exists and user is the creator
  SELECT id, created_by INTO game_id, creator_profile_id 
  FROM games 
  WHERE id = game_uuid;
  
  IF game_id IS NULL THEN
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

-- Function to create a new round
CREATE OR REPLACE FUNCTION create_new_round(game_uuid UUID, round_num INTEGER)
RETURNS UUID AS $$
DECLARE
  board_config_id UUID;
  round_id UUID;
BEGIN
  -- Create a new board configuration
  INSERT INTO board_configurations (game_id, config_data)
  VALUES (game_uuid, generate_board_config())
  RETURNING id INTO board_config_id;
  
  -- Create robots, targets, and walls for the board
  PERFORM populate_board(board_config_id);
  
  -- Create the round
  INSERT INTO rounds (game_id, round_number, board_config_id)
  VALUES (game_uuid, round_num, board_config_id)
  RETURNING id INTO round_id;
  
  RETURN round_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate a board configuration
CREATE OR REPLACE FUNCTION generate_board_config()
RETURNS JSONB AS $$
BEGIN
  -- In a real implementation, this would generate a random board layout
  -- For now, return a simple default configuration
  RETURN '{"board_size": 16, "num_robots": 4}';
END;
$$ LANGUAGE plpgsql;

-- Function to populate a board with robots, targets and walls
CREATE OR REPLACE FUNCTION populate_board(board_id UUID)
RETURNS VOID AS $$
DECLARE
  board_config JSONB;
  board_size INTEGER;
  num_robots INTEGER;
  robot_colors TEXT[] := ARRAY['red', 'blue', 'green', 'yellow'];
  i INTEGER;
BEGIN
  -- Get board configuration
  SELECT config_data INTO board_config 
  FROM board_configurations 
  WHERE id = board_id;
  
  board_size := (board_config->>'board_size')::INTEGER;
  num_robots := (board_config->>'num_robots')::INTEGER;
  
  -- Create robots
  FOR i IN 1..num_robots LOOP
    INSERT INTO robots (board_id, color, position_x, position_y)
    VALUES (
      board_id, 
      robot_colors[i], 
      floor(random() * board_size) + 1, 
      floor(random() * board_size) + 1
    );
  END LOOP;
  
  -- Create a target
  INSERT INTO targets (board_id, color, position_x, position_y)
  VALUES (
    board_id,
    robot_colors[floor(random() * num_robots) + 1],
    floor(random() * board_size) + 1,
    floor(random() * board_size) + 1
  );
  
  -- Create some walls (simplified)
  FOR i IN 1..20 LOOP
    INSERT INTO walls (board_id, position_x, position_y, direction)
    VALUES (
      board_id,
      floor(random() * board_size) + 1,
      floor(random() * board_size) + 1,
      (ARRAY['north', 'east', 'south', 'west'])[floor(random() * 4) + 1]
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to submit a solution for a round
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
    
    -- Update the round with the winner
    UPDATE rounds
    SET winner_id = participant_id,
        winning_moves = move_count,
        completed_at = NOW()
    WHERE id = round_uuid AND (winner_id IS NULL OR winning_moves > move_count);
    
    -- Update participant score
    UPDATE game_participants
    SET score = score + 1
    WHERE id = participant_id AND EXISTS (
      SELECT 1 FROM rounds WHERE rounds.id = round_uuid AND rounds.winner_id = participant_id
    );
    
    -- Check if this was the last round
    SELECT max_rounds INTO max_rounds FROM games WHERE id = game_id;
    
    IF round_number >= max_rounds THEN
      -- End the game
      UPDATE games
      SET status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = game_id;
    ELSE
      -- Create the next round
      PERFORM create_new_round(game_id, round_number + 1);
    END IF;
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current game state
CREATE OR REPLACE FUNCTION get_game_state(game_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'game', jsonb_build_object(
      'id', games.id,
      'name', games.name,
      'status', games.status,
      'max_players', games.max_players,
      'max_rounds', games.max_rounds,
      'created_at', games.created_at,
      'current_round', (
        SELECT rounds.round_number
        FROM rounds
        WHERE rounds.game_id = games.id
        AND rounds.completed_at IS NULL
        ORDER BY rounds.round_number
        LIMIT 1
      )
    ),
    'participants', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', gp.id,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'score', gp.score
      ))
      FROM game_participants gp
      JOIN profiles p ON gp.profile_id = p.id
      WHERE gp.game_id = games.id
    ),
    'current_board', (
      SELECT jsonb_build_object(
        'id', bc.id,
        'config', bc.config_data,
        'robots', (
          SELECT jsonb_agg(jsonb_build_object(
            'id', r.id,
            'color', r.color,
            'x', r.position_x,
            'y', r.position_y
          ))
          FROM robots r
          WHERE r.board_id = bc.id
        ),
        'targets', (
          SELECT jsonb_agg(jsonb_build_object(
            'id', t.id,
            'color', t.color,
            'x', t.position_x,
            'y', t.position_y
          ))
          FROM targets t
          WHERE t.board_id = bc.id
        ),
        'walls', (
          SELECT jsonb_agg(jsonb_build_object(
            'id', w.id,
            'x', w.position_x,
            'y', w.position_y,
            'direction', w.direction
          ))
          FROM walls w
          WHERE w.board_id = bc.id
        )
      )
      FROM rounds r
      JOIN board_configurations bc ON r.board_config_id = bc.id
      WHERE r.game_id = games.id
      AND r.completed_at IS NULL
      ORDER BY r.round_number
      LIMIT 1
    )
  ) INTO result
  FROM games
  WHERE games.id = game_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start a round with timing
CREATE OR REPLACE FUNCTION start_round(round_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE rounds
  SET start_time = NOW()
  WHERE id = round_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 