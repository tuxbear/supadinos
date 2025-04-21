-- Migration to remove max_players column from games table
-- A game now includes all invited players and no one else

-- Remove max_players column from games table
ALTER TABLE games DROP COLUMN max_players;

-- Update the join_game function to remove max_players references
CREATE OR REPLACE FUNCTION join_game(game_uuid UUID)
RETURNS UUID AS $$
DECLARE
  profile_id UUID;
  game_status game_status;
  participant_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO profile_id FROM profiles WHERE user_id = auth.uid();
  
  -- Check if the game exists and is in waiting status
  SELECT status INTO game_status
  FROM games WHERE id = game_uuid;
  
  IF game_status != 'waiting' THEN
    RAISE EXCEPTION 'Cannot join game that is not in waiting status';
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

-- Update the create_game function to remove max_players parameter
CREATE OR REPLACE FUNCTION create_game(
  game_name TEXT,
  max_rounds INTEGER DEFAULT 10
)
RETURNS UUID AS $$
DECLARE
  new_game_id UUID;
  current_user_profile_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles WHERE user_id = auth.uid();
  
  IF current_user_profile_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Insert the new game
  INSERT INTO games (
    name, 
    status, 
    max_rounds, 
    created_by
  )
  VALUES (
    game_name, 
    'waiting', 
    max_rounds, 
    current_user_profile_id
  )
  RETURNING id INTO new_game_id;
  
  -- Add the creator as a participant
  INSERT INTO game_participants (game_id, profile_id)
  VALUES (new_game_id, current_user_profile_id);
  
  RETURN new_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_game_state function to remove max_players field
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

-- Update the create_game_with_friends function to remove max_players parameter
CREATE OR REPLACE FUNCTION create_game_with_friends(
  game_name TEXT,
  max_rounds INTEGER,
  friend_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  current_user_profile_id UUID;
  new_game_id UUID;
  current_friend_id UUID;
BEGIN
  -- Get the profile ID of the authenticated user
  SELECT id INTO current_user_profile_id FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Validate max_rounds
  IF max_rounds < 5 OR max_rounds > 15 THEN
    max_rounds := 10; -- Default to 10 if invalid
  END IF;
  
  -- Create the game
  INSERT INTO games (name, created_by, max_rounds)
  VALUES (game_name, current_user_profile_id, max_rounds)
  RETURNING id INTO new_game_id;
  
  -- Add the creator as a participant
  INSERT INTO game_participants (game_id, profile_id)
  VALUES (new_game_id, current_user_profile_id);
  
  -- Add friends as participants
  FOREACH current_friend_id IN ARRAY friend_ids
  LOOP
    -- Verify this is a valid friend using explicit column qualifiers
    IF EXISTS (
      SELECT 1 FROM friendships f1
      WHERE (
        (f1.user_id = current_user_profile_id AND f1.friend_id = current_friend_id)
        OR 
        (f1.user_id = current_friend_id AND f1.friend_id = current_user_profile_id)
      )
      AND f1.status = 'accepted'
    ) THEN
      -- Add friend as participant
      INSERT INTO game_participants (game_id, profile_id)
      VALUES (new_game_id, current_friend_id);
    END IF;
  END LOOP;
  
  RETURN new_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 