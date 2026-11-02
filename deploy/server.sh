#!/usr/bin/env bash
# Compose wrapper: explicit database mode, stable project name, existing ingress.
set -euo pipefail

root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$root_dir"

if [[ $# -lt 2 ]]; then
  echo 'Usage: bash deploy/server.sh external|managed|remote [--proxy|--tunnel] COMPOSE_COMMAND [ARGS...]' >&2
  exit 2
fi
db_mode="$1"
shift
compose=(docker compose --env-file .env.server -f docker-compose.server.yml)
# Otherwise the top-level Compose name reads SERVER_PROJECT from .env.server.
if [[ -n "${SERVER_PROJECT:-}" ]]; then
  compose+=(-p "$SERVER_PROJECT")
fi
case "$db_mode" in
  external) compose+=(-f docker-compose.database.yml) ;;
  managed) compose+=(-f docker-compose.postgres.yml) ;;
  remote) ;;
  *) echo 'Database mode must be external, managed or remote.' >&2; exit 2 ;;
esac
case "${1:-}" in
  --proxy) compose+=(-f docker-compose.proxy.yml); shift ;;
  --tunnel) compose+=(-f docker-compose.cloudflared.yml --profile tunnel); shift ;;
esac
if [[ $# -eq 0 ]]; then
  echo 'Missing Docker Compose command.' >&2
  exit 2
fi
if [[ ! -f .env.server ]]; then
  echo 'Missing .env.server. Copy .env.server.example and configure the database and backend env file.' >&2
  exit 2
fi
exec "${compose[@]}" "$@"
