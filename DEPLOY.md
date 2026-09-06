# Deploy on VPS with Docker

One command **on the server**. Builds, configures, opens ports, and health-checks.

Works on a **shared VPS** — HTTP **7777** and HTTPS **8443** so it does not need 80/443.

---

## Quick start (on the VPS)

```bash
cd /home/lms/Cyber-Zeb-LMS
chmod +x deploy/vps-docker.sh
./deploy/vps-docker.sh --ip 195.201.117.22
```

IP is auto-detected if you omit `--ip`. First run takes a few minutes.

**Share with stakeholders:** `https://YOUR_VPS_IP:8443`  
HTTP fallback: `http://YOUR_VPS_IP:7777`  
**Demo login password:** `Demo123!`

The browser will warn on the self-signed certificate. Click **Advanced → Proceed**.

### Where credentials go

| Secret | File | Used by |
|--------|------|---------|
| **Zoom** Account ID, Client ID, Client Secret | **Project root `.env`** on the VPS | Docker `api` container |
| Optional Zoom host email | Same `.env` as `ZOOM_USER_EMAIL` | API (skip user-list scope) |
| Super Admin / JWT | Same root `.env` | API (script fills JWT if empty) |
| Local Zoom test on your PC | `backend/.env` | Local uvicorn only — **not** Docker |

Docker reads **only** the root `.env` (`env_file: .env` in `docker-compose.yml`).  
Do not put Zoom keys in the frontend or in `.env.local`.

After you paste Zoom keys:

```bash
docker compose up -d --force-recreate api
```

Marketplace scopes: `meeting:write:meeting:admin` and `user:read:list_users:admin` (or set `ZOOM_USER_EMAIL`). Activate the app again after changing scopes.

### Options

```bash
./deploy/vps-docker.sh --ip 195.201.117.22
./deploy/vps-docker.sh --http-port 7777 --https-port 8443
./deploy/vps-docker.sh --http-only
```

---

## What the script does

1. Installs Docker and the compose plugin if they are missing
2. Writes a complete `.env` (public IP, ports, JWT secret, CORS)
3. Creates `deploy/certs/cert.pem` + `key.pem` when missing
4. Allows TCP 7777 and 8443 in `ufw` (does not enable ufw)
5. `docker compose up --build -d --force-recreate`
6. `curl` health-checks `127.0.0.1:7777` and `127.0.0.1:8443`

---

## What runs in Docker

| Container | Role |
|-----------|------|
| **web** | Frontend + nginx (proxies `/api` to backend) |
| **api** | FastAPI + **SQLite** database (no Postgres/Redis) |

Only **2 containers**. Demo data is seeded automatically on first start.

Database is **SQLite** in a Docker volume (no Postgres).

---

## Useful commands

```bash
docker compose ps
docker compose logs -f web api
./deploy/vps-docker.sh --ip YOUR_VPS_IP    # rebuild / repair
docker compose down                        # stop
docker compose down -v                     # stop + wipe database
```

If `curl` works on the VPS but the browser does not, open **TCP 7777** and **TCP 8443** in the cloud firewall panel (Hetzner, etc.). Host `ufw` is not enough by itself.

---

## Get code onto the VPS without git

From the project folder on Windows:

```powershell
deploy\build-and-pack.cmd
```

Upload `deploy\berana-release.zip` with WinSCP, then on the VPS:

```bash
unzip -o berana-release.zip -d Cyber-Zeb-LMS
cd Cyber-Zeb-LMS
# Paste Zoom keys into .env if they are not already there
chmod +x deploy/vps-docker.sh
./deploy/vps-docker.sh --ip YOUR_VPS_IP
```

That rebuilds **web** (Zoom UI + PDF reports) and **api** (Zoom create/end meeting). Existing SQLite data in the Docker volume is kept.

---

## No-Docker fallback

See `deploy/run_demo.py` and `deploy/install-vps.sh` if you ever need a lightweight Python-only deploy without Docker.
