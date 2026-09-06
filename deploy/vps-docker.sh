#!/bin/bash
# Complete VPS Docker deployment for Berana LMS (Cyber-Zeb-LMS).
#
# One command on the server (as root is fine):
#   chmod +x deploy/vps-docker.sh
#   ./deploy/vps-docker.sh
#
# Optional:
#   ./deploy/vps-docker.sh --ip 195.201.117.22
#   ./deploy/vps-docker.sh --http-port 7777 --https-port 8443
#   ./deploy/vps-docker.sh --http-only
#
# What this does:
#   1. Installs Docker + compose plugin if missing
#   2. Writes a complete .env (IP, ports, JWT, CORS)
#   3. Creates a self-signed TLS cert for the VPS IP
#   4. Opens host firewall ports (ufw) — does NOT enable ufw
#   5. Builds and starts web + api
#   6. Health-checks HTTP (and HTTPS) on localhost
#
# Demo password: Demo123!

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CLI_IP=""
HTTP_PORT="7777"
HTTPS_PORT="8443"
HTTP_ONLY=0
SKIP_FIREWALL=0
COMPOSE_FILE="docker-compose.yml"
ORIGINAL_ARGS=("$@")

usage() {
  cat <<EOF
Usage: ./deploy/vps-docker.sh [options]

  --ip ADDRESS          Public VPS IP (auto-detected if omitted)
  --http-port PORT      Host HTTP port (default: 7777, not 80)
  --https-port PORT     Host HTTPS port (default: 8443, not 443)
  --http-only           Skip TLS certs; HTTP only
  --skip-firewall       Do not run ufw allow
  -h, --help            Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --ip)
      [ -n "${2:-}" ] || { echo "Missing value for --ip"; exit 1; }
      CLI_IP="$2"
      shift 2
      ;;
    --http-port)
      [ -n "${2:-}" ] || { echo "Missing value for --http-port"; exit 1; }
      HTTP_PORT="$2"
      shift 2
      ;;
    --https-port)
      [ -n "${2:-}" ] || { echo "Missing value for --https-port"; exit 1; }
      HTTPS_PORT="$2"
      shift 2
      ;;
    --http-only) HTTP_ONLY=1; shift ;;
    --skip-firewall) SKIP_FIREWALL=1; shift ;;
    --postgres)
      echo "Postgres is disabled for this deploy. SQLite is used."
      exit 1
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if ! echo "$HTTP_PORT" | grep -Eq '^[0-9]+$'; then
  echo "Invalid --http-port: $HTTP_PORT"
  exit 1
fi
if ! echo "$HTTPS_PORT" | grep -Eq '^[0-9]+$'; then
  echo "Invalid --https-port: $HTTPS_PORT"
  exit 1
fi

if [ "$HTTP_PORT" = "80" ] || [ "$HTTP_PORT" = "443" ]; then
  echo "Host port 80/443 are in use on this VPS. Using HTTP 7777 instead."
  HTTP_PORT="7777"
fi
if [ "$HTTPS_PORT" = "80" ] || [ "$HTTPS_PORT" = "443" ]; then
  echo "Host port 80/443 are in use on this VPS. Using HTTPS 8443 instead."
  HTTPS_PORT="8443"
fi

log() { echo ""; echo "==> $*"; }

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

ensure_pkg() {
  command -v "$1" >/dev/null 2>&1 && return 0
  if [ "$(id -u)" -ne 0 ]; then
    echo "Missing '$1'. Re-run as root or install it, then retry."
    exit 1
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y "$2"
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "Installing Docker"
    if [ "$(id -u)" -ne 0 ]; then
      echo "Docker is not installed. Re-run as root: sudo $0 ${ORIGINAL_ARGS[*]}"
      exit 1
    fi
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker 2>/dev/null || true
    if [ -n "${SUDO_USER:-}" ]; then
      usermod -aG docker "$SUDO_USER" 2>/dev/null || true
    fi
  fi

  if ! docker compose version >/dev/null 2>&1; then
    log "Installing docker compose plugin"
    if [ "$(id -u)" -ne 0 ]; then
      echo "docker compose plugin missing. Install: apt install docker-compose-plugin"
      exit 1
    fi
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y docker-compose-plugin
  fi

  if ! docker info >/dev/null 2>&1; then
    if [ "$(id -u)" -eq 0 ]; then
      echo "Docker is installed but the daemon is not running."
      echo "Start it: systemctl start docker"
      exit 1
    fi
    echo "Cannot talk to Docker. Either:"
    echo "  sudo $0 ${ORIGINAL_ARGS[*]}"
    echo "  or log out/in after being added to the docker group."
    exit 1
  fi
}

dc() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

# ---------------------------------------------------------------------------
# IP / env / certs
# ---------------------------------------------------------------------------

detect_public_ip() {
  if [ -n "$CLI_IP" ]; then
    echo "$CLI_IP"
    return
  fi

  local ip=""
  ip="$(curl -4 -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)"
  if echo "$ip" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "$ip"
    return
  fi
  ip="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  if echo "$ip" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "$ip"
    return
  fi
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if echo "$ip" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "$ip"
    return
  fi
  echo ""
}

env_get() {
  local key="$1"
  grep -E "^${key}=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"\r' || true
}

upsert_env() {
  local key="$1"
  local value="$2"
  if [ -f .env ] && grep -q "^${key}=" .env; then
    grep -v "^${key}=" .env > .env.tmp || true
    mv .env.tmp .env
  fi
  printf '%s=%s\n' "$key" "$value" >> .env
}

ensure_env() {
  local ip="$1"
  if [ ! -f .env ]; then
    cp .env.docker.example .env
  fi
  # Host checkout from Windows may leave CRLF, which breaks Docker port env vars.
  sed -i 's/\r$//' .env 2>/dev/null || true

  local jwt
  jwt="$(env_get JWT_SECRET_KEY)"
  if [ -z "$jwt" ] || [ "$jwt" = "change-this-to-a-long-random-secret" ]; then
    jwt="$(openssl rand -hex 32)"
  fi

  local http_url="http://${ip}:${HTTP_PORT}"
  local https_url="https://${ip}:${HTTPS_PORT}"
  local public_url="$http_url"
  local cors="[\"${http_url}\"]"
  local use_https="false"
  local dockerfile="Dockerfile"

  if [ "$HTTP_ONLY" -eq 0 ]; then
    public_url="$https_url"
    cors="[\"${http_url}\",\"${https_url}\"]"
    use_https="true"
    dockerfile="Dockerfile.https"
  fi

  upsert_env USE_HTTPS "$use_https"
  upsert_env WEB_DOCKERFILE "$dockerfile"
  upsert_env HTTP_PORT "$HTTP_PORT"
  upsert_env HTTPS_PORT "$HTTPS_PORT"
  upsert_env PUBLIC_URL "$public_url"
  upsert_env CORS_ORIGINS "$cors"
  upsert_env DATABASE_URL "sqlite+aiosqlite:////code/data/brana_lms.db"
  upsert_env DATABASE_URL_SYNC "sqlite:////code/data/brana_lms.db"
  upsert_env JWT_SECRET_KEY "$jwt"
  upsert_env PLATFORM_SUPER_ADMIN_EMAIL "superadmin@berana.edu"
  upsert_env PLATFORM_SUPER_ADMIN_PASSWORD "Demo123!"

  # Keep existing Zoom keys. Only add empty placeholders if they are missing.
  for zoom_key in ZOOM_ACCOUNT_ID ZOOM_CLIENT_ID ZOOM_CLIENT_SECRET ZOOM_USER_EMAIL; do
    if ! grep -q "^${zoom_key}=" .env 2>/dev/null; then
      upsert_env "$zoom_key" ""
    fi
  done
}

ensure_certs() {
  local ip="$1"
  local cert_dir="$ROOT/deploy/certs"
  mkdir -p "$cert_dir"

  if [ "$HTTP_ONLY" -eq 1 ]; then
    log "HTTP-only mode — skipping TLS certificates"
    return
  fi

  ensure_pkg openssl openssl

  if [ -f "$cert_dir/cert.pem" ] && [ -f "$cert_dir/key.pem" ]; then
    log "TLS certs already exist in deploy/certs (keeping them)"
    return
  fi

  log "Creating self-signed TLS certificate for IP $ip"
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$cert_dir/key.pem" \
    -out "$cert_dir/cert.pem" \
    -subj "/CN=$ip" \
    -addext "subjectAltName=IP:$ip"
  chmod 644 "$cert_dir/cert.pem"
  chmod 600 "$cert_dir/key.pem"
}

open_firewall() {
  if [ "$SKIP_FIREWALL" -eq 1 ]; then
    return
  fi
  if ! command -v ufw >/dev/null 2>&1; then
    log "ufw not installed — open TCP ${HTTP_PORT} and ${HTTPS_PORT} in the cloud firewall panel"
    return
  fi

  log "Allowing host firewall ports ${HTTP_PORT} and ${HTTPS_PORT}"
  ufw allow "${HTTP_PORT}/tcp" || true
  if [ "$HTTP_ONLY" -eq 0 ]; then
    ufw allow "${HTTPS_PORT}/tcp" || true
  fi

  if ufw status 2>/dev/null | grep -qi inactive; then
    echo "Note: ufw is inactive. If the provider firewall is on (Hetzner, etc.),"
    echo "      open TCP ${HTTP_PORT} and ${HTTPS_PORT} in that panel too."
  fi
}

# ---------------------------------------------------------------------------
# Health checks
# ---------------------------------------------------------------------------

wait_http() {
  local url="$1"
  local extra="${2:-}"
  local i
  for i in $(seq 1 40); do
    # shellcheck disable=SC2086
    if curl -fsS -o /dev/null -I $extra "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

print_failure() {
  echo ""
  echo "----- docker compose ps -----"
  dc ps -a || true
  echo ""
  echo "----- web logs -----"
  dc logs --tail=80 web || true
  echo ""
  echo "----- api logs -----"
  dc logs --tail=80 api || true
  echo ""
  echo "----- listeners -----"
  ss -tlnp 2>/dev/null | grep -E "${HTTP_PORT}|${HTTPS_PORT}" || true
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

log "Berana LMS — complete Docker deploy"
ensure_docker
ensure_pkg curl curl
ensure_pkg openssl openssl

IP="$(detect_public_ip)"
if [ -z "$IP" ]; then
  echo "Could not detect the public IP. Re-run with:"
  echo "  ./deploy/vps-docker.sh --ip YOUR_VPS_IP"
  exit 1
fi

log "Using public IP ${IP}  HTTP :${HTTP_PORT}  HTTPS :${HTTPS_PORT}"
ensure_env "$IP"
ensure_certs "$IP"
open_firewall

if [ -z "$(env_get ZOOM_ACCOUNT_ID)" ] || [ -z "$(env_get ZOOM_CLIENT_ID)" ] || [ -z "$(env_get ZOOM_CLIENT_SECRET)" ]; then
  echo ""
  echo "Zoom credentials are empty in .env. Live meetings will fail until you add:"
  echo "  ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET"
  echo "in ${ROOT}/.env  then: docker compose up -d --force-recreate api"
fi

log "Building and starting containers (first run takes a few minutes)"
dc up --build -d --force-recreate --remove-orphans

echo ""
dc ps

HTTP_URL="http://${IP}:${HTTP_PORT}"
HTTPS_URL="https://${IP}:${HTTPS_PORT}"

log "Waiting for HTTP on localhost:${HTTP_PORT}"
if wait_http "http://127.0.0.1:${HTTP_PORT}"; then
  echo "HTTP OK  -> ${HTTP_URL}"
else
  echo "HTTP failed on 127.0.0.1:${HTTP_PORT}"
  print_failure
  exit 1
fi

if [ "$HTTP_ONLY" -eq 0 ]; then
  log "Waiting for HTTPS on localhost:${HTTPS_PORT}"
  if wait_http "https://127.0.0.1:${HTTPS_PORT}" "-k"; then
    echo "HTTPS OK -> ${HTTPS_URL}"
  else
    echo "HTTPS failed on 127.0.0.1:${HTTPS_PORT} (HTTP still works)."
    print_failure
    echo ""
    echo "Use HTTP for now: ${HTTP_URL}"
    echo "Typical HTTPS causes: WEB_DOCKERFILE not rebuilt, missing certs, or port not published."
    exit 1
  fi
fi

cat <<EOF

============================================================
 Deployed
------------------------------------------------------------
 HTTP:     ${HTTP_URL}
 HTTPS:    ${HTTPS_URL}
 API docs: ${HTTPS_URL}/docs
 Demo password: Demo123!

 Zoom keys: ${ROOT}/.env  (ZOOM_ACCOUNT_ID / CLIENT_ID / CLIENT_SECRET)
 Then:      docker compose up -d --force-recreate api

 Browser HTTPS warning is expected (self-signed cert).
 Click Advanced → Proceed.

 If it works here (curl) but not in a browser, open TCP
 ${HTTP_PORT} and ${HTTPS_PORT} in the cloud/VPS firewall panel.

 Logs:  docker compose -f ${COMPOSE_FILE} logs -f web api
 Stop:  docker compose -f ${COMPOSE_FILE} down
============================================================
EOF
