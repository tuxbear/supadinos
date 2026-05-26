-- Desperate Dinos: privacy, timers, board fixes, notifications, validation

-- ---------------------------------------------------------------------------
-- Game config: round time limit (default 24 hours)
-- ---------------------------------------------------------------------------
ALTER TABLE games ADD COLUMN IF NOT EXISTS round_time_limit_seconds INTEGER NOT NULL DEFAULT 86400;

-- ---------------------------------------------------------------------------
-- Notification enum extensions
-- ---------------------------------------------------------------------------
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'player_finished_round';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'round_results_ready';

-- ---------------------------------------------------------------------------
-- Fix populate_board (wall_y typo, board_id shadowing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION populate_board(p_board_id UUID)
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
  SELECT config_data INTO board_config
  FROM board_configurations
  WHERE id = p_board_id;

  board_size := (board_config->>'board_size')::INTEGER;
  num_robots := (board_config->>'num_robots')::INTEGER;
  num_wall_pairs := COALESCE((board_config->>'num_wall_pairs')::INTEGER, 10);

  FOR i IN 1..num_wall_pairs LOOP
    wall_x := floor(random() * (board_size - 2)) + 2;
    wall_y := floor(random() * (board_size - 2)) + 2;
    wall_direction := (ARRAY['north', 'east', 'south', 'west'])[floor(random() * 4) + 1];

    CASE wall_direction
      WHEN 'north' THEN
        INSERT INTO walls (board_id, position_x, position_y, direction)
        VALUES (p_board_id, wall_x, wall_y, 'north'), (p_board_id, wall_x, wall_y, 'west');
      WHEN 'east' THEN
        INSERT INTO walls (board_id, position_x, position_y, direction)
        VALUES (p_board_id, wall_x, wall_y, 'east'), (p_board_id, wall_x, wall_y, 'north');
      WHEN 'south' THEN
        INSERT INTO walls (board_id, position_x, position_y, direction)
        VALUES (p_board_id, wall_x, wall_y, 'south'), (p_board_id, wall_x, wall_y, 'east');
      WHEN 'west' THEN
        INSERT INTO walls (board_id, position_x, position_y, direction)
        VALUES (p_board_id, wall_x, wall_y, 'west'), (p_board_id, wall_x, wall_y, 'south');
    END CASE;
  END LOOP;

  LOOP
    SELECT position_x, position_y, direction INTO wall_x, wall_y, wall_direction
    FROM walls
    WHERE walls.board_id = p_board_id
    ORDER BY random()
    LIMIT 1;

    CASE wall_direction
      WHEN 'north' THEN target_x := wall_x; target_y := wall_y - 1;
      WHEN 'east' THEN target_x := wall_x + 1; target_y := wall_y;
      WHEN 'south' THEN target_x := wall_x; target_y := wall_y + 1;
      WHEN 'west' THEN target_x := wall_x - 1; target_y := wall_y;
    END CASE;

    IF target_x >= 1 AND target_x <= board_size AND target_y >= 1 AND target_y <= board_size THEN
      EXIT;
    END IF;
  END LOOP;

  target_color := robot_colors[floor(random() * num_robots) + 1];

  INSERT INTO targets (board_id, color, position_x, position_y)
  VALUES (p_board_id, target_color, target_x, target_y);

  FOR i IN 1..num_robots LOOP
    LOOP
      target_x := floor(random() * board_size) + 1;
      target_y := floor(random() * board_size) + 1;

      SELECT NOT EXISTS (
        SELECT 1 FROM walls w
        WHERE w.board_id = p_board_id
        AND w.position_x = target_x AND w.position_y = target_y
      ) AND NOT EXISTS (
        SELECT 1 FROM targets t
        WHERE t.board_id = p_board_id
        AND t.position_x = target_x AND t.position_y = target_y
      ) AND NOT EXISTS (
        SELECT 1 FROM robots r
        WHERE r.board_id = p_board_id
        AND r.position_x = target_x AND r.position_y = target_y
      ) INTO valid_positions;

      IF valid_positions THEN EXIT; END IF;
    END LOOP;

    INSERT INTO robots (board_id, color, position_x, position_y)
    VALUES (p_board_id, robot_colors[i], target_x, target_y);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- validate_move with qualified board id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_move(
  p_board_id UUID,
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
  SELECT (config_data->>'board_size')::INTEGER INTO board_size
  FROM board_configurations
  WHERE id = p_board_id;

  IF from_x < 1 OR from_x > board_size OR from_y < 1 OR from_y > board_size OR
     to_x < 1 OR to_x > board_size OR to_y < 1 OR to_y > board_size THEN
    RETURN FALSE;
  END IF;

  step_x := CASE WHEN to_x > from_x THEN 1 WHEN to_x < from_x THEN -1 ELSE 0 END;
  step_y := CASE WHEN to_y > from_y THEN 1 WHEN to_y < from_y THEN -1 ELSE 0 END;

  IF (step_x != 0 AND step_y != 0) OR (step_x = 0 AND step_y = 0) THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM robots
    WHERE board_id = p_board_id AND color = robot_color
    AND position_x = from_x AND position_y = from_y
  ) THEN
    RETURN FALSE;
  END IF;

  current_x := from_x + step_x;
  current_y := from_y + step_y;

  WHILE (current_x != to_x + step_x OR current_y != to_y + step_y) LOOP
    SELECT EXISTS (
      SELECT 1 FROM walls w
      WHERE w.board_id = p_board_id
      AND (
        (w.position_x = current_x - step_x AND w.position_y = current_y - step_y AND w.direction = CASE
          WHEN step_x > 0 THEN 'east' WHEN step_x < 0 THEN 'west'
          WHEN step_y > 0 THEN 'south' ELSE 'north' END)
        OR
        (w.position_x = current_x AND w.position_y = current_y AND w.direction = CASE
          WHEN step_x > 0 THEN 'west' WHEN step_x < 0 THEN 'east'
          WHEN step_y > 0 THEN 'north' ELSE 'south' END)
      )
    ) INTO has_wall;

    IF has_wall THEN RETURN FALSE; END IF;

    SELECT EXISTS (
      SELECT 1 FROM robots r
      WHERE r.board_id = p_board_id
      AND r.position_x = current_x AND r.position_y = current_y
      AND r.color != robot_color
    ) INTO has_robot;

    IF has_robot THEN RETURN FALSE; END IF;

    current_x := current_x + step_x;
    current_y := current_y + step_y;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Slide validation using simulated robot positions (for multi-move solutions)
CREATE OR REPLACE FUNCTION validate_slide_sim(
  p_board_id UUID,
  robot_color TEXT,
  from_x INTEGER,
  from_y INTEGER,
  to_x INTEGER,
  to_y INTEGER,
  sim_positions JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  board_size INTEGER;
  step_x INTEGER;
  step_y INTEGER;
  current_x INTEGER;
  current_y INTEGER;
  has_wall BOOLEAN;
  other_color TEXT;
  other_x INTEGER;
  other_y INTEGER;
BEGIN
  SELECT (config_data->>'board_size')::INTEGER INTO board_size
  FROM board_configurations WHERE id = p_board_id;

  IF (sim_positions->robot_color->>'x')::INTEGER != from_x
     OR (sim_positions->robot_color->>'y')::INTEGER != from_y THEN
    RETURN FALSE;
  END IF;

  step_x := CASE WHEN to_x > from_x THEN 1 WHEN to_x < from_x THEN -1 ELSE 0 END;
  step_y := CASE WHEN to_y > from_y THEN 1 WHEN to_y < from_y THEN -1 ELSE 0 END;

  IF (step_x != 0 AND step_y != 0) OR (step_x = 0 AND step_y = 0) THEN
    RETURN FALSE;
  END IF;

  current_x := from_x + step_x;
  current_y := from_y + step_y;

  WHILE (current_x != to_x + step_x OR current_y != to_y + step_y) LOOP
    IF current_x < 1 OR current_x > board_size OR current_y < 1 OR current_y > board_size THEN
      RETURN FALSE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM walls w
      WHERE w.board_id = p_board_id
      AND (
        (w.position_x = current_x - step_x AND w.position_y = current_y - step_y AND w.direction = CASE
          WHEN step_x > 0 THEN 'east' WHEN step_x < 0 THEN 'west'
          WHEN step_y > 0 THEN 'south' ELSE 'north' END)
        OR
        (w.position_x = current_x AND w.position_y = current_y AND w.direction = CASE
          WHEN step_x > 0 THEN 'west' WHEN step_x < 0 THEN 'east'
          WHEN step_y > 0 THEN 'north' ELSE 'south' END)
      )
    ) INTO has_wall;

    IF has_wall THEN RETURN FALSE; END IF;

    FOR other_color IN SELECT jsonb_object_keys(sim_positions) LOOP
      IF other_color != robot_color THEN
        other_x := (sim_positions->other_color->>'x')::INTEGER;
        other_y := (sim_positions->other_color->>'y')::INTEGER;
        IF other_x = current_x AND other_y = current_y THEN
          RETURN FALSE;
        END IF;
      END IF;
    END LOOP;

    current_x := current_x + step_x;
    current_y := current_y + step_y;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Validate full solution (simulated positions; does not mutate board robots)
CREATE OR REPLACE FUNCTION validate_solution_moves(p_board_id UUID, moves_json JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  move_count INTEGER;
  i INTEGER;
  c TEXT;
  fx INTEGER; fy INTEGER; tx INTEGER; ty INTEGER;
  target_c TEXT;
  target_x INTEGER;
  target_y INTEGER;
  sim_positions JSONB;
  r RECORD;
BEGIN
  move_count := jsonb_array_length(moves_json);
  IF move_count < 1 THEN RETURN FALSE; END IF;

  SELECT t.color, t.position_x, t.position_y INTO target_c, target_x, target_y
  FROM targets t WHERE t.board_id = p_board_id LIMIT 1;

  sim_positions := '{}'::jsonb;
  FOR r IN SELECT color, position_x, position_y FROM robots WHERE board_id = p_board_id LOOP
    sim_positions := sim_positions || jsonb_build_object(
      r.color, jsonb_build_object('x', r.position_x, 'y', r.position_y)
    );
  END LOOP;

  FOR i IN 0..move_count-1 LOOP
    c := moves_json->i->>'color';
    fx := (moves_json->i->>'from_x')::INTEGER;
    fy := (moves_json->i->>'from_y')::INTEGER;
    tx := (moves_json->i->>'to_x')::INTEGER;
    ty := (moves_json->i->>'to_y')::INTEGER;

    IF (sim_positions->c->>'x')::INTEGER != fx OR (sim_positions->c->>'y')::INTEGER != fy THEN
      RETURN FALSE;
    END IF;

    IF NOT validate_slide_sim(p_board_id, c, fx, fy, tx, ty, sim_positions) THEN
      RETURN FALSE;
    END IF;

    sim_positions := jsonb_set(
      sim_positions, ARRAY[c],
      jsonb_build_object('x', tx, 'y', ty)
    );
  END LOOP;

  IF (sim_positions->target_c->>'x')::INTEGER != target_x
     OR (sim_positions->target_c->>'y')::INTEGER != target_y THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- create_new_round: copy time limit from game
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_new_round(game_uuid UUID, round_num INTEGER)
RETURNS UUID AS $$
DECLARE
  board_config_id UUID;
  round_id UUID;
  time_limit INTEGER;
BEGIN
  SELECT COALESCE(round_time_limit_seconds, 86400) INTO time_limit
  FROM games WHERE id = game_uuid;

  INSERT INTO board_configurations (game_id, config_data)
  VALUES (game_uuid, generate_board_config())
  RETURNING id INTO board_config_id;

  PERFORM populate_board(board_config_id);

  INSERT INTO rounds (game_id, round_number, board_config_id, time_limit_seconds)
  VALUES (game_uuid, round_num, board_config_id, time_limit)
  RETURNING id INTO round_id;

  RETURN round_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- create_game_with_friends with round time limit (hours stored as seconds)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_game_with_friends(
  game_name TEXT,
  max_rounds INTEGER,
  friend_ids UUID[],
  round_time_limit_seconds INTEGER DEFAULT 86400
)
RETURNS UUID AS $$
DECLARE
  current_user_profile_id UUID;
  new_game_id UUID;
  current_friend_id UUID;
  limit_seconds INTEGER;
BEGIN
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();

  IF max_rounds < 5 OR max_rounds > 15 THEN
    max_rounds := 10;
  END IF;

  limit_seconds := COALESCE(round_time_limit_seconds, 86400);
  IF limit_seconds < 3600 THEN
    limit_seconds := 3600;
  ELSIF limit_seconds > 604800 THEN
    limit_seconds := 604800;
  END IF;

  INSERT INTO games (name, created_by, max_rounds, round_time_limit_seconds)
  VALUES (game_name, current_user_profile_id, max_rounds, limit_seconds)
  RETURNING id INTO new_game_id;

  INSERT INTO game_participants (game_id, profile_id)
  VALUES (new_game_id, current_user_profile_id);

  FOREACH current_friend_id IN ARRAY friend_ids LOOP
    IF EXISTS (
      SELECT 1 FROM friendships f1
      WHERE (
        (f1.user_id = current_user_profile_id AND f1.friend_id = current_friend_id)
        OR (f1.user_id = current_friend_id AND f1.friend_id = current_user_profile_id)
      )
      AND f1.status = 'accepted'
    ) THEN
      INSERT INTO game_participants (game_id, profile_id)
      VALUES (new_game_id, current_friend_id)
      ON CONFLICT (game_id, profile_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN new_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- join_game: invited participants only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_game(game_uuid UUID)
RETURNS UUID AS $$
DECLARE
  profile_id UUID;
  game_status game_status;
  participant_id UUID;
BEGIN
  SELECT id INTO profile_id FROM profiles WHERE user_id = auth.uid();

  SELECT status INTO game_status FROM games WHERE id = game_uuid;

  IF game_status != 'waiting' THEN
    RAISE EXCEPTION 'Cannot join game that is not in waiting status';
  END IF;

  SELECT gp.id INTO participant_id
  FROM game_participants gp
  WHERE gp.game_id = game_uuid AND gp.profile_id = profile_id;

  IF participant_id IS NULL THEN
    RAISE EXCEPTION 'You are not invited to this game';
  END IF;

  RETURN participant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- submit_solution with validation and duplicate guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_solution(round_id UUID, moves_json JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_profile_id UUID;
  participant_var UUID;
  game_var UUID;
  board_var UUID;
  move_count INTEGER;
  start_time TIMESTAMP WITH TIME ZONE;
  time_spent NUMERIC;
  already_done BOOLEAN;
BEGIN
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();

  SELECT rounds.game_id, rounds.board_config_id INTO game_var, board_var
  FROM rounds WHERE rounds.id = round_id;

  SELECT gp.id INTO participant_var
  FROM game_participants gp
  WHERE gp.game_id = game_var AND gp.profile_id = current_user_profile_id;

  IF participant_var IS NULL THEN
    RAISE EXCEPTION 'User is not a participant in this game';
  END IF;

  SELECT (rp.end_time IS NOT NULL OR rp.has_forfeit) INTO already_done
  FROM round_participants rp
  WHERE rp.round_id = round_id AND rp.participant_id = participant_var;

  IF already_done THEN
    RAISE EXCEPTION 'You have already completed this round';
  END IF;

  SELECT rp.start_time INTO start_time
  FROM round_participants rp
  WHERE rp.round_id = round_id AND rp.participant_id = participant_var;

  IF start_time IS NULL THEN
    RAISE EXCEPTION 'Round has not been started for this participant';
  END IF;

  move_count := jsonb_array_length(moves_json);
  IF move_count < 1 THEN
    RAISE EXCEPTION 'Solution must include at least one move';
  END IF;

  IF NOT validate_solution_moves(board_var, moves_json) THEN
    RAISE EXCEPTION 'Invalid solution';
  END IF;

  time_spent := EXTRACT(EPOCH FROM (NOW() - start_time));

  FOR i IN 0..move_count-1 LOOP
    INSERT INTO moves (
      round_id, participant_id, robot_color, move_number,
      from_x, from_y, to_x, to_y
    )
    VALUES (
      round_id, participant_var,
      moves_json->i->>'color', i + 1,
      (moves_json->i->>'from_x')::INTEGER,
      (moves_json->i->>'from_y')::INTEGER,
      (moves_json->i->>'to_x')::INTEGER,
      (moves_json->i->>'to_y')::INTEGER
    );
  END LOOP;

  UPDATE round_participants rp
  SET end_time = NOW(),
      time_spent_seconds = time_spent,
      moves_count = move_count,
      has_forfeit = FALSE
  WHERE rp.round_id = round_id AND rp.participant_id = participant_var;

  PERFORM check_round_completion(round_id);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- forfeit expired participants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION forfeit_expired_round_participants()
RETURNS INTEGER AS $$
DECLARE
  rec RECORD;
  forfeited INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT rp.round_id, rp.participant_id, rp.start_time, r.time_limit_seconds
    FROM round_participants rp
    JOIN rounds r ON r.id = rp.round_id
    WHERE rp.end_time IS NULL
      AND rp.has_forfeit = FALSE
      AND rp.start_time IS NOT NULL
      AND r.completed_at IS NULL
      AND NOW() > rp.start_time + (r.time_limit_seconds * INTERVAL '1 second')
  LOOP
    UPDATE round_participants
    SET has_forfeit = TRUE,
        end_time = NOW(),
        time_spent_seconds = rec.time_limit_seconds
  WHERE round_id = rec.round_id AND participant_id = rec.participant_id;

    PERFORM check_round_completion(rec.round_id);
    forfeited := forfeited + 1;
  END LOOP;

  RETURN forfeited;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- get_round_standings (privacy-safe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_round_standings(p_round_id UUID)
RETURNS JSONB AS $$
DECLARE
  current_profile_id UUID;
  my_participant_id UUID;
  round_completed BOOLEAN;
  time_limit INTEGER;
  round_num INTEGER;
  game_var UUID;
  result JSONB;
BEGIN
  SELECT id INTO current_profile_id FROM profiles WHERE user_id = auth.uid();

  SELECT r.game_id, r.round_number, r.completed_at IS NOT NULL, r.time_limit_seconds
  INTO game_var, round_num, round_completed, time_limit
  FROM rounds r WHERE r.id = p_round_id;

  SELECT gp.id INTO my_participant_id
  FROM game_participants gp
  WHERE gp.game_id = game_var AND gp.profile_id = current_profile_id;

  IF my_participant_id IS NULL THEN
    RAISE EXCEPTION 'Not a participant in this game';
  END IF;

  SELECT jsonb_build_object(
    'round_id', p_round_id,
    'round_number', round_num,
    'round_status', CASE WHEN round_completed THEN 'completed' ELSE 'active' END,
    'time_limit_seconds', time_limit,
    'my_participant_id', my_participant_id,
    'players', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'participant_id', gp.id,
          'username', p.username,
          'is_me', gp.id = my_participant_id,
          'status', CASE
            WHEN rp.has_forfeit THEN 'forfeited'
            WHEN rp.end_time IS NOT NULL THEN 'submitted'
            WHEN rp.start_time IS NOT NULL THEN 'playing'
            ELSE 'not_started'
          END,
          'moves_count', CASE
            WHEN round_completed OR gp.id = my_participant_id THEN rp.moves_count
            ELSE NULL
          END,
          'time_seconds', CASE
            WHEN round_completed OR gp.id = my_participant_id THEN rp.time_spent_seconds
            ELSE NULL
          END,
          'is_winner', round_completed AND r.winner_id = gp.id
        ) ORDER BY p.username
      ), '[]'::jsonb)
      FROM game_participants gp
      JOIN profiles p ON p.id = gp.profile_id
      LEFT JOIN round_participants rp ON rp.participant_id = gp.id AND rp.round_id = p_round_id
      LEFT JOIN rounds r ON r.id = p_round_id
      WHERE gp.game_id = game_var
    ),
    'winner_participant_id', (SELECT winner_id FROM rounds WHERE id = p_round_id)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- RLS: round_participants and moves privacy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Game participants can view round participants" ON round_participants;
DROP POLICY IF EXISTS "Users can view round participants in completed rounds or own" ON round_participants;

CREATE POLICY "Users can view round participants in completed rounds or own"
  ON round_participants FOR SELECT
  USING (
    participant_id IN (
      SELECT gp.id FROM game_participants gp
      JOIN profiles pr ON pr.id = gp.profile_id
      WHERE pr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM rounds r
      WHERE r.id = round_participants.round_id AND r.completed_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Game participants can view moves" ON moves;
DROP POLICY IF EXISTS "Users can view moves in completed rounds or own" ON moves;

CREATE POLICY "Users can view moves in completed rounds or own"
  ON moves FOR SELECT
  USING (
    participant_id IN (
      SELECT gp.id FROM game_participants gp
      JOIN profiles pr ON pr.id = gp.profile_id
      WHERE pr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM rounds r
      WHERE r.id = moves.round_id AND r.completed_at IS NOT NULL
    )
  );

-- Restrict game_participants SELECT to games user is in
DROP POLICY IF EXISTS "Anyone can view game participants" ON game_participants;
DROP POLICY IF EXISTS "Users can view participants in their games" ON game_participants;

CREATE POLICY "Users can view participants in their games"
  ON game_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants gp2
      JOIN profiles pr ON pr.id = gp2.profile_id
      WHERE gp2.game_id = game_participants.game_id
      AND pr.user_id = auth.uid()
    )
  );

-- Fix game_messages RLS
DROP POLICY IF EXISTS "Game participants can view messages" ON game_messages;
CREATE POLICY "Game participants can view messages"
  ON game_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants gp
      JOIN profiles pr ON pr.id = gp.profile_id
      WHERE gp.game_id = game_messages.game_id
      AND pr.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications: fix triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS notify_on_game_creation ON games;
DROP TRIGGER IF EXISTS notify_on_moves_submission ON moves;

CREATE OR REPLACE FUNCTION notify_game_participant_invited()
RETURNS TRIGGER AS $$
DECLARE
  creator_name TEXT;
  game_name TEXT;
  creator_id UUID;
BEGIN
  IF NEW.profile_id = (SELECT created_by FROM games WHERE id = NEW.game_id) THEN
    RETURN NEW;
  END IF;

  SELECT g.created_by, g.name INTO creator_id, game_name FROM games g WHERE g.id = NEW.game_id;
  SELECT username INTO creator_name FROM profiles WHERE id = creator_id;

  PERFORM create_notification(
    NEW.profile_id,
    'new_game',
    COALESCE(creator_name, 'Someone') || ' invited you to play "' || game_name || '"',
    NEW.game_id,
    NULL,
    creator_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_on_participant_invited
AFTER INSERT ON game_participants
FOR EACH ROW
EXECUTE FUNCTION notify_game_participant_invited();

CREATE OR REPLACE FUNCTION notify_player_finished_round()
RETURNS TRIGGER AS $$
DECLARE
  game_id UUID;
  round_number INTEGER;
  finisher_name TEXT;
  finisher_profile_id UUID;
BEGIN
  IF NEW.end_time IS NULL AND NEW.has_forfeit = FALSE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.end_time IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.game_id, r.round_number INTO game_id, round_number
  FROM rounds r WHERE r.id = NEW.round_id;

  SELECT p.username, gp.profile_id INTO finisher_name, finisher_profile_id
  FROM game_participants gp
  JOIN profiles p ON p.id = gp.profile_id
  WHERE gp.id = NEW.participant_id;

  PERFORM notify_game_participants(
    game_id,
    'player_finished_round',
    COALESCE(finisher_name, 'A player') || ' finished Round ' || round_number,
    NEW.round_id,
    finisher_profile_id,
    finisher_profile_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_on_player_finished ON round_participants;
CREATE TRIGGER notify_on_player_finished
AFTER INSERT OR UPDATE ON round_participants
FOR EACH ROW
EXECUTE FUNCTION notify_player_finished_round();

CREATE OR REPLACE FUNCTION notify_round_results_ready()
RETURNS TRIGGER AS $$
DECLARE
  game_name TEXT;
BEGIN
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD IS NULL) THEN
    SELECT name INTO game_name FROM games WHERE id = NEW.game_id;

    PERFORM notify_game_participants(
      NEW.game_id,
      'round_results_ready',
      'Round ' || NEW.round_number || ' results are in for "' || COALESCE(game_name, 'your game') || '" — tap to view',
      NEW.id,
      NULL,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_on_round_completion ON rounds;
CREATE TRIGGER notify_on_round_results_ready
AFTER UPDATE ON rounds
FOR EACH ROW
EXECUTE FUNCTION notify_round_results_ready();

-- Update create_notification push titles for new types
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
  INSERT INTO notifications (user_id, type, game_id, round_id, sender_id, message)
  VALUES (p_user_id, p_type, p_game_id, p_round_id, p_sender_id, p_message)
  RETURNING id INTO notification_id;

  CASE p_type
    WHEN 'new_game' THEN push_title := 'Game Invitation';
    WHEN 'player_finished_round' THEN push_title := 'Round Update';
    WHEN 'round_results_ready' THEN push_title := 'Round Results';
    WHEN 'round_over' THEN push_title := 'Round Completed';
    WHEN 'game_over' THEN push_title := 'Game Over';
    ELSE push_title := 'Desperate Dinos';
  END CASE;

  PERFORM send_push_notification(
    p_user_id, push_title, p_message,
    jsonb_build_object('notificationId', notification_id, 'type', p_type, 'gameId', p_game_id, 'roundId', p_round_id)
  );

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Register push token
CREATE OR REPLACE FUNCTION register_push_token(p_push_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE profiles SET push_token = p_push_token
  WHERE user_id = auth.uid();
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List games for current user only
CREATE OR REPLACE FUNCTION get_my_games()
RETURNS SETOF games AS $$
DECLARE
  profile_id UUID;
BEGIN
  SELECT id INTO profile_id FROM profiles WHERE user_id = auth.uid();
  RETURN QUERY
  SELECT g.* FROM games g
  JOIN game_participants gp ON gp.game_id = g.id
  WHERE gp.profile_id = profile_id
  ORDER BY g.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
