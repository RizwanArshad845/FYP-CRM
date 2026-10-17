-- 004_enable_rls: lock down Supabase's auto-generated REST/GraphQL API.
-- Supabase exposes every table in `public` to the `anon` and `authenticated`
-- roles. Enabling RLS with no policies denies those roles entirely. The Express
-- backend connects as the table owner, which bypasses RLS, so it is unaffected;
-- all access control stays in the API (protect / requireRole / tenant filters).
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;
