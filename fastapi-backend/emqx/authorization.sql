-- Paste into EMQX PostgreSQL Authorization query. Order matters: explicit deny,
-- then scoped allow, then catch-all deny for any credential known to this DB.
SELECT permission, action, topic
FROM public.emqx_mqtt_authz
WHERE username = ${username}
ORDER BY priority DESC;
