-- Paste into EMQX PostgreSQL Authentication query; placeholder is bound by EMQX.
-- Password hashing: bcrypt. No extra salt column; bcrypt embeds its salt/cost.
SELECT password_hash, is_superuser
FROM public.emqx_mqtt_authn
WHERE username = ${username}
LIMIT 1;
