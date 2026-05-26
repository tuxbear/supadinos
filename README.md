# Desperate Dinos

Async multiplayer mobile puzzle game (Expo + Supabase), inspired by Ricochet Robots.

## Stack

- React Native (Expo 52)
- Supabase (Auth, Postgres, Realtime, Edge Functions)
- React Navigation

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Configure environment (`.env` or Expo env):

```bash
EXPO_PUBLIC_SUPABASE_URL=your_project_url
EXPO_PUBLIC_SUPABASE_KEY=your_anon_key
```

3. Apply database migrations:

```bash
supabase db push
```

4. (Optional) Deploy push edge function:

```bash
supabase functions deploy send-push
```

5. Run the app:

```bash
yarn start
```

## Game flow

1. Sign up / sign in
2. Add friends
3. Create a game (rounds, hours per round, invite friends)
4. Friends open the game from **My Games** (invited players only)
5. Creator starts when 2+ players are ready
6. Each player plays each round within the time limit; opponent round stats stay hidden until the round ends
7. Notifications when others finish and when round results are ready

## Tests

```bash
yarn test
```

Unit tests cover Ricochet movement logic in `src/game/ricochetMovement.test.ts`.

## Migrations

Game schema and RPCs live under `supabase/migrations/`. The latest migration adds privacy RLS, hour-based round limits, move validation, and notification fixes.
