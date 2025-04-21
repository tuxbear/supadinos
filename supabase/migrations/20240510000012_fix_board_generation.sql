-- Update board generation logic to ensure proper wall placement and target positioning

-- First, update the board configuration generation
CREATE OR REPLACE FUNCTION generate_board_config()
RETURNS JSONB AS $$
BEGIN
  -- Return a configuration that ensures proper board setup
  RETURN jsonb_build_object(
    'board_size', 16,
    'num_robots', 4,
    'num_wall_pairs', 10  -- Number of wall pairs (each pair creates a corner)
  );
END;
$$ LANGUAGE plpgsql;

-- Update the board population function
CREATE OR REPLACE FUNCTION populate_board(board_id UUID)
RETURNS VOID AS $$
DECLARE
  board_config JSONB;
  board_size INTEGER;
  num_robots INTEGER;
  num_wall_pairs INTEGER;
  robot_colors TEXT[] := ARRAY['red', 'blue', 'green', 'yellow'];
  i INTEGER;
  wall_x INTEGER;
  wall_y INTEGER;
  wall_direction TEXT;
  target_x INTEGER;
  target_y INTEGER;
  target_color TEXT;
  valid_positions BOOLEAN;
BEGIN
  -- Get board configuration
  SELECT config_data INTO board_config 
  FROM board_configurations 
  WHERE id = board_id;
  
  board_size := (board_config->>'board_size')::INTEGER;
  num_robots := (board_config->>'num_robots')::INTEGER;
  num_wall_pairs := (board_config->>'num_wall_pairs')::INTEGER;
  
  -- Create wall pairs (corners)
  FOR i IN 1..num_wall_pairs LOOP
    -- Generate a random position that's not on the edge
    wall_x := floor(random() * (board_size - 2)) + 2;
    wall_y := floor(random() * (board_size - 2)) + 2;
    
    -- Randomly choose a corner direction
    wall_direction := (ARRAY['north', 'east', 'south', 'west'])[floor(random() * 4) + 1];
    
    -- Insert the wall pair based on the direction
    CASE wall_direction
      WHEN 'north' THEN
        -- Create a corner facing north
        INSERT INTO walls (board_id, position_x, position_y, direction)
        VALUES (board_id, wall_x, wall_y, 'north');
        INSERT INTO walls (board_id, position_x, position_y, direction)
        VALUES (board_id, wall_x, wall_y, 'west');
      WHEN 'east' THEN
        -- Create a corner facing east
        INSERT INTO walls (board_id, position_x, position_y, direction)
        VALUES (board_id, wall_x, wall_y, 'east');
        INSERT INTO walls (board_id, position_x, position_y, direction)
        VALUES (board_id, wall_x, wall_y, 'north');
      WHEN 'south' THEN
        -- Create a corner facing south
        INSERT INTO walls (board_id, position_x, wall_y, direction)
        VALUES (board_id, wall_x, wall_y, 'south');
        INSERT INTO walls (board_id, position_x, wall_y, direction)
        VALUES (board_id, wall_x, wall_y, 'east');
      WHEN 'west' THEN
        -- Create a corner facing west
        INSERT INTO walls (board_id, position_x, wall_y, direction)
        VALUES (board_id, wall_x, wall_y, 'west');
        INSERT INTO walls (board_id, position_x, wall_y, direction)
        VALUES (board_id, wall_x, wall_y, 'south');
    END CASE;
  END LOOP;
  
  -- Place the target next to a wall
  LOOP
    -- Get a random wall
    SELECT position_x, position_y, direction INTO wall_x, wall_y, wall_direction
    FROM walls
    WHERE board_id = board_id
    ORDER BY random()
    LIMIT 1;
    
    -- Calculate target position based on wall position and direction
    CASE wall_direction
      WHEN 'north' THEN
        target_x := wall_x;
        target_y := wall_y - 1;
      WHEN 'east' THEN
        target_x := wall_x + 1;
        target_y := wall_y;
      WHEN 'south' THEN
        target_x := wall_x;
        target_y := wall_y + 1;
      WHEN 'west' THEN
        target_x := wall_x - 1;
        target_y := wall_y;
    END CASE;
    
    -- Check if target position is valid (within board bounds)
    IF target_x >= 1 AND target_x <= board_size AND target_y >= 1 AND target_y <= board_size THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Choose a random robot color for the target
  target_color := robot_colors[floor(random() * num_robots) + 1];
  
  -- Insert the target
  INSERT INTO targets (board_id, color, position_x, position_y)
  VALUES (board_id, target_color, target_x, target_y);
  
  -- Place robots in valid positions (not on walls or target)
  FOR i IN 1..num_robots LOOP
    LOOP
      -- Generate random position
      target_x := floor(random() * board_size) + 1;
      target_y := floor(random() * board_size) + 1;
      
      -- Check if position is valid (not on a wall or target)
      SELECT NOT EXISTS (
        SELECT 1 FROM walls 
        WHERE board_id = board_id 
        AND position_x = target_x 
        AND position_y = target_y
      ) AND NOT EXISTS (
        SELECT 1 FROM targets 
        WHERE board_id = board_id 
        AND position_x = target_x 
        AND position_y = target_y
      ) INTO valid_positions;
      
      IF valid_positions THEN
        EXIT;
      END IF;
    END LOOP;
    
    -- Insert the robot
    INSERT INTO robots (board_id, color, position_x, position_y)
    VALUES (board_id, robot_colors[i], target_x, target_y);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add a function to validate moves
CREATE OR REPLACE FUNCTION validate_move(
  board_id UUID,
  robot_color TEXT,
  from_x INTEGER,
  from_y INTEGER,
  to_x INTEGER,
  to_y INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  board_size INTEGER;
  step_x INTEGER;
  step_y INTEGER;
  current_x INTEGER;
  current_y INTEGER;
  has_wall BOOLEAN;
  has_robot BOOLEAN;
BEGIN
  -- Get board size
  SELECT (config_data->>'board_size')::INTEGER INTO board_size
  FROM board_configurations
  WHERE id = board_id;
  
  -- Validate coordinates are within bounds
  IF from_x < 1 OR from_x > board_size OR from_y < 1 OR from_y > board_size OR
     to_x < 1 OR to_x > board_size OR to_y < 1 OR to_y > board_size THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate direction of movement
  step_x := CASE WHEN to_x > from_x THEN 1 WHEN to_x < from_x THEN -1 ELSE 0 END;
  step_y := CASE WHEN to_y > from_y THEN 1 WHEN to_y < from_y THEN -1 ELSE 0 END;
  
  -- Ensure movement is in a straight line
  IF (step_x != 0 AND step_y != 0) OR (step_x = 0 AND step_y = 0) THEN
    RETURN FALSE;
  END IF;
  
  -- Check each position along the path
  current_x := from_x + step_x;
  current_y := from_y + step_y;
  
  WHILE (current_x != to_x + step_x OR current_y != to_y + step_y) LOOP
    -- Check for walls
    SELECT EXISTS (
      SELECT 1 FROM walls
      WHERE board_id = board_id
      AND position_x = current_x
      AND position_y = current_y
      AND (
        (step_x > 0 AND direction = 'west') OR
        (step_x < 0 AND direction = 'east') OR
        (step_y > 0 AND direction = 'north') OR
        (step_y < 0 AND direction = 'south')
      )
    ) INTO has_wall;
    
    IF has_wall THEN
      RETURN FALSE;
    END IF;
    
    -- Check for other robots
    SELECT EXISTS (
      SELECT 1 FROM robots
      WHERE board_id = board_id
      AND position_x = current_x
      AND position_y = current_y
      AND color != robot_color
    ) INTO has_robot;
    
    IF has_robot THEN
      RETURN FALSE;
    END IF;
    
    current_x := current_x + step_x;
    current_y := current_y + step_y;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql; 