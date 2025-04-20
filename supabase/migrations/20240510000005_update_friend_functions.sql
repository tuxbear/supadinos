-- Function to send a friend request
CREATE OR REPLACE FUNCTION public.send_friend_request(friend_username TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- Validate friend exists
    IF friend_profile_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Prevent self-friending
    IF friend_profile_id = current_user_profile_id THEN
        RAISE EXCEPTION 'Cannot send friend request to yourself';
    END IF;
    
    -- Check if friendship already exists
    SELECT id INTO existing_friendship_id FROM friendships
    WHERE (user_id = current_user_profile_id AND friend_id = friend_profile_id)
       OR (user_id = friend_profile_id AND friend_id = current_user_profile_id);
    
    IF existing_friendship_id IS NOT NULL THEN
        RAISE EXCEPTION 'Friendship or request already exists';
    END IF;
    
    -- Insert the friendship request
    INSERT INTO friendships (user_id, friend_id, status)
    VALUES (current_user_profile_id, friend_profile_id, 'pending')
    RETURNING id INTO new_friendship_id;
    
    RETURN new_friendship_id;
END;
$$;

-- Function to accept a friend request
CREATE OR REPLACE FUNCTION public.accept_friend_request(friendship_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Function to reject a friend request
CREATE OR REPLACE FUNCTION public.reject_friend_request(friendship_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- Delete the friendship request
    DELETE FROM friendships
    WHERE id = friendship_id;
    
    RETURN TRUE;
END;
$$;

-- Function to get all friends and pending requests
CREATE OR REPLACE FUNCTION public.get_friends()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$; 