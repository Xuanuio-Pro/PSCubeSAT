#!/usr/bin/env bash
# Initial deployment for the confirmed server: pscubesat + existing tunnel,
# no running CubeSAT DB. Creates its own PostgreSQL volume; never deletes data.
set -euo pipefail
trap 'status=$?; printf "Initialization stopped at line %s (exit %s). Send the last terminal error above.\n" "$LINENO" "$status" >&2; exit "$status"' ERR
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$root_dir"
export SERVER_PROJECT=pscubesat
export SERVER_NETWORK_NAME=pscubesat_cubesat_net
export SERVER_NETWORK_EXTERNAL=true

# Replacing a connector from a different project would leave two active origins.
if docker container inspect cloudflared-cubesat >/dev/null 2>&1; then
  legacy_project="$(docker inspect cloudflared-cubesat --format '{{index .Config.Labels "com.docker.compose.project"}}')"
  if [[ "$legacy_project" != "$SERVER_PROJECT" ]]; then
    echo 'Existing cloudflared-cubesat is not owned by project pscubesat; inspect the deployment before proceeding.' >&2
    exit 1
  fi
fi

docker build -t pscubesat-backend:setup fastapi-backend
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/workspace" \
  pscubesat-backend:setup python -m scripts.setup_managed_server \
  --root /workspace --project pscubesat --frontend-port 5173 \
  --release-tag "${1:-server-db}" --tunnel --reuse-network pscubesat_cubesat_net

# Adopt the old network without changing its driver/config hash. Compose must
# never recreate it while old frontend/Redis/tunnel endpoints are attached.
if ! docker network inspect pscubesat_cubesat_net >/dev/null 2>&1; then
  docker network create --driver bridge pscubesat_cubesat_net
fi

bash deploy/server.sh managed --tunnel config --quiet
bash deploy/server.sh managed --tunnel build frontend fastapi
bash deploy/server.sh managed --tunnel up -d --wait postgres
bash deploy/server.sh managed --tunnel run --rm --no-deps migrate python server_preflight.py --database
bash deploy/server.sh managed --tunnel run --rm --no-deps migrate
bash deploy/server.sh managed --tunnel up -d --wait --wait-timeout 180
bash deploy/server.sh managed --tunnel ps -a
bash deploy/server.sh managed --tunnel exec -T fastapi python -m scripts.check_server_http --public
# Start and verify DB/API first, then prepare firmware compilation. A toolchain
# build failure must not prevent the web backend from being brought online.
docker build -f fastapi-backend/compiler/Dockerfile -t pscubesat-compiler:server-db fastapi-backend
bash deploy/server.sh managed --tunnel run --rm --no-deps fastapi python server_preflight.py --live
