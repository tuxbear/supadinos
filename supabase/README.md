# Desperate Dinos Game Database Schema

This directory contains Supabase migrations for setting up the database schema for a Desperate Dinos inspired game.

## Database Schema

The database schema represents a multiplayer game with the following structure:

- **Users/Profiles**: Players participating in games
- **Games**: Game sessions with 2-10 players and 5-15 rounds
- **Rounds**: Individual rounds within a game, each with a board configuration
- **Board Elements**: Robots, targets, and walls representing the game board

## Tables

1. **profiles**: User profiles linked to Supabase Auth
2. **games**: Game sessions with metadata
3. **game_participants**: Players participating in games
4. **board_configurations**: Board layouts for each round
5. **robots**: Robot pieces on the board
6. **targets**: Target locations on the board
7. **walls**: Wall positions on the board
8. **rounds**: Game rounds with references to board configurations
9. **moves**: Player moves during a round

## Functions

The schema includes several helper functions:

- `join_game`: Allow a user to join a game
- `start_game`: Start a game when enough players have joined
- `create_new_round`: Create a new round with a board configuration
- `generate_board_config`: Generate a board layout
- `populate_board`: Create robots, targets, and walls for a board
- `submit_solution`: Submit a solution for a round
- `get_game_state`: Get the current state of a game

## Row Level Security

Row Level Security (RLS) policies are implemented to ensure users can only:
- View games they are participating in
- Join games that are in "waiting" status
- Submit solutions for active rounds they are participating in
- View other participants in their games

## Applying Migrations

To apply these migrations to your Supabase project:

1. Set up the Supabase CLI (if not already installed):
   ```
   npm install -g supabase
   ```

2. Link your Supabase project:
   ```
   supabase link --project-ref your-project-ref
   ```

3. Apply migrations:
   ```
   supabase db push
   ```

## Notes on the Desperate Dinos Game Model

This schema models a digital version of the Desperate Dinos board game:

- The game board consists of a grid with walls
- Players control robots that move in straight lines until they hit a wall or another robot
- The goal is to move a specific robot to a target location in the fewest moves
- Each round has a different board configuration
- The player who solves the puzzle in the fewest moves wins the round
- Points are accumulated across rounds to determine the game winner 