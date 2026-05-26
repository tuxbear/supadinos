-- Schedule periodic forfeits when pg_cron is available (Supabase hosted)
DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule('forfeit-expired-round-participants');
  PERFORM cron.schedule(
    'forfeit-expired-round-participants',
    '*/5 * * * *',
    'SELECT forfeit_expired_round_participants()'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END $cron$;
