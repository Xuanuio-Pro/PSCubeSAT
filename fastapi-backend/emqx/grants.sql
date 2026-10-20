-- Run with psql as the database administrator AFTER migration 0005.
-- Creates no password in source/logs. Set the login password interactively using:
--   \password pscubesat_emqx_reader
-- Never reuse the application database user's password for the broker.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pscubesat_emqx_reader') THEN
        CREATE ROLE pscubesat_emqx_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END $$;
GRANT USAGE ON SCHEMA public TO pscubesat_emqx_reader;
GRANT SELECT ON public.emqx_mqtt_authn, public.emqx_mqtt_authz TO pscubesat_emqx_reader;
-- Do not grant SELECT on users or write permissions on any application table.
