# HSE App — Azure Deployment Guide

This document describes how the HSE platform is deployed on Azure:

| Component | Azure resource | GitHub repo |
|-----------|----------------|-------------|
| Database | Azure Database for MySQL Flexible Server | — |
| Backend API | Azure App Service (Python / Linux) | `develepor04/hse_app_service_backend` |
| Frontend UI | Azure App Service (Node / Linux) | `develepor04/hse_app_service_frontend` |

---

## Architecture (high level)

```text
Browser
   │
   ▼
Azure App Service (Frontend)
  Node 24 · server.js serves Vite dist/
   │  HTTPS API calls (VITE_API_URL)
   ▼
Azure App Service (Backend)
  Python 3.12 · FastAPI · Uvicorn
   │  MySQL over SSL
   ▼
Azure Database for MySQL Flexible Server
  Database: hse (or hse_db)
```

---

## 1. Azure Database for MySQL Flexible Server

### 1.1 Create the server

| Setting | Recommended value |
|---------|-------------------|
| Subscription | Your Azure subscription |
| Resource group | Shared DB RG (e.g. `thetadynamics_mysql_db_resource_group`) or HSE-specific |
| Server name | `hse-mysql-db-server` |
| Region | Same as App Services if possible (subscription may block some regions, e.g. UK South) |
| MySQL version | 8.0 or 8.4 |
| Workload | Dev/Test for non-prod |
| Compute | Burstable **B1ms** (dev) — scale up for production |
| High availability | Disabled for Dev/Test |
| Authentication | MySQL authentication only |
| Admin login | e.g. `mysql_administrator` |
| Admin password | Strong password (store in a password manager / Key Vault) |

### 1.2 Networking

1. Open the MySQL server → **Networking**.
2. Enable **Public access** (or use private endpoints for production).
3. Add firewall rules:
   - Your current client IP (for DBeaver / local migrations).
   - **Allow public access from any Azure service within Azure** = **Yes** (simplest way for App Service to connect in Dev/Test).
4. SSL/TLS is enforced (TLS 1.2+) — keep it on.

> If “Allow Azure services” is **No** and no App Service outbound IPs are allowlisted, the backend cannot reach MySQL.

### 1.3 Create the application database

Connect with DBeaver / MySQL client:

| Field | Value |
|-------|--------|
| Host | `hse-mysql-db-server.mysql.database.azure.com` |
| Port | `3306` |
| User | `mysql_administrator` |
| Password | *(admin password)* |
| SSL | Required |

DBeaver driver properties (if needed):

- `useSSL` = `true`
- `requireSSL` = `true`
- `allowPublicKeyRetrieval` = `true`

Then:

```sql
CREATE DATABASE hse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 1.4 Run migrations (from a machine that can reach MySQL)

From the `backend` repo (with env pointing at Azure MySQL):

```powershell
cd backend
# Set DB_* / DATABASE_URL to Azure (see §2.3)
python migrations/run_migrations.py
python migrations/run_migrations.py --status
```

Also run one-off scripts if needed on a fresh DB (e.g. `migrations/add_full_name.py`).

### 1.5 Seed login users (optional, local/dev)

```powershell
python seeds/run_seeds.py --only app_roles
python seeds/run_seeds.py --only roles
$env:SUPERADMIN_PASSWORD='SuperAdmin@123'
python create_superadmin.py
```

Or create users with bcrypt against Azure MySQL. Default seed-style accounts (change in production):

| Email | Password | Role |
|-------|----------|------|
| `superadmin@hse-intel.com` | `SuperAdmin@123` | superadmin |
| `admin@hse-intel.com` | `Admin@123` | admin |

Login accepts **email or username**.

---

## 2. Backend — Azure App Service

### 2.1 Create the Web App

| Setting | Value |
|---------|--------|
| Name | e.g. `hse-app-service-backend` |
| Runtime | **Python 3.12** |
| OS | **Linux** |
| Region | Same as MySQL when possible |
| App Service plan | e.g. `hse-backend-asp` (B1 for Dev/Test) |
| Identity (GitHub Actions) | Prefer a **new** user-assigned identity (e.g. `hse-backend-identity`) with **Website Contributor** on this app — do not reuse other products’ identities |

Connect deployment to GitHub: `develepor04/hse_app_service_backend` → branch `main`.

### 2.2 Startup command

```text
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2.3 Application settings (App Service → Configuration)

Open **Configuration** → **Application settings** (or **Environment variables** in the new portal UI).

These keys are **not** created automatically — use **+ Add** for each missing name, then **Apply** and **Restart**.

**CORS (required for the Azure frontend to call the API):**

| Name | Value |
|------|--------|
| `ALLOWED_ORIGINS` | `https://hse-app-service-frontend-gjgqh3ffgrghgddc.uksouth-01.azurewebsites.net,https://dashboard.ehsera.com,http://localhost:5173,http://localhost:3000` |
| `FRONTEND_BASE_URL` | `https://hse-app-service-frontend-gjgqh3ffgrghgddc.uksouth-01.azurewebsites.net` |

Replace the frontend hostname if your App Service name/region URL differs. If you skip `ALLOWED_ORIGINS`, the browser shows:

`blocked by CORS policy: No 'Access-Control-Allow-Origin' header`

That is a **backend** config issue, not a wrong frontend API URL.

Use **Advanced edit** or add individually. **Never commit real secrets to Git.**

Full settings example (include CORS entries above):

```json
[
  { "name": "SCM_DO_BUILD_DURING_DEPLOYMENT", "value": "1", "slotSetting": false },
  { "name": "APP_ENV", "value": "production", "slotSetting": false },
  { "name": "DEBUG", "value": "false", "slotSetting": false },
  { "name": "DB_HOST", "value": "hse-mysql-db-server.mysql.database.azure.com", "slotSetting": false },
  { "name": "DB_PORT", "value": "3306", "slotSetting": false },
  { "name": "DB_NAME", "value": "hse", "slotSetting": false },
  { "name": "DB_USER", "value": "mysql_administrator", "slotSetting": false },
  { "name": "DB_PASSWORD", "value": "YOUR_MYSQL_PASSWORD", "slotSetting": false },
  {
    "name": "DATABASE_URL",
    "value": "mysql+pymysql://mysql_administrator:URL_ENCODED_PASSWORD@hse-mysql-db-server.mysql.database.azure.com:3306/hse?ssl=true",
    "slotSetting": false
  },
  { "name": "JWT_SECRET", "value": "LONG_RANDOM_SECRET", "slotSetting": false },
  {
    "name": "ALLOWED_ORIGINS",
    "value": "https://hse-app-service-frontend-gjgqh3ffgrghgddc.uksouth-01.azurewebsites.net,https://dashboard.ehsera.com,http://localhost:5173,http://localhost:3000",
    "slotSetting": false
  },
  {
    "name": "FRONTEND_BASE_URL",
    "value": "https://hse-app-service-frontend-gjgqh3ffgrghgddc.uksouth-01.azurewebsites.net",
    "slotSetting": false
  },
  { "name": "EMAIL_BACKEND", "value": "smtp", "slotSetting": false },
  { "name": "SMTP_HOST", "value": "smtp.gmail.com", "slotSetting": false },
  { "name": "SMTP_PORT", "value": "587", "slotSetting": false },
  { "name": "SMTP_USE_TLS", "value": "true", "slotSetting": false },
  { "name": "SMTP_USE_SSL", "value": "false", "slotSetting": false },
  { "name": "SMTP_USER", "value": "YOUR_SMTP_USER", "slotSetting": false },
  { "name": "SMTP_PASSWORD", "value": "YOUR_SMTP_APP_PASSWORD", "slotSetting": false },
  { "name": "SMTP_FROM_EMAIL", "value": "YOUR_SMTP_USER", "slotSetting": false },
  { "name": "SMTP_FROM_NAME", "value": "HSE Intelligence", "slotSetting": false },
  { "name": "ANTHROPIC_API_KEY", "value": "YOUR_KEY", "slotSetting": false },
  { "name": "ANTHROPIC_BASE_URL", "value": "YOUR_AZURE_AI_ANTHROPIC_BASE_URL", "slotSetting": false },
  { "name": "ANTHROPIC_MODEL", "value": "claude-sonnet-4-6", "slotSetting": false },
  { "name": "LOG_LEVEL", "value": "INFO", "slotSetting": false }
]
```

Notes:

- Use **`JWT_SECRET`** (not `JWT_SECRET_KEY`) — matches `app/config/settings.py`.
- URL-encode special characters in `DATABASE_URL` (e.g. `$` → `%24`).
- Include SSL for Azure MySQL. Prefer keeping `?ssl=true` in `DATABASE_URL` **only if** the app uses the fixed `database.py` SSL handling (PyMySQL cannot take `ssl` as the string `"true"`). The backend strips that query flag and enables TLS via `connect_args`. You may also omit `?ssl=true` — Azure hosts are still detected and TLS is enabled automatically.
- Generate JWT secret: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- **Always add the live frontend App Service URL to `ALLOWED_ORIGINS`** after the frontend is created (see CORS table above).
### 2.4 Verify backend

| Check | URL |
|-------|-----|
| Health | `https://<backend-host>/health` |
| Swagger | `https://<backend-host>/docs` |
| Root `/` | Often `{"detail":"Not Found"}` — **normal** (no route on `/`) |

API routes are under `/api/v1/...`.

---

## 3. Frontend — Azure App Service

### 3.1 Create the Web App

| Setting | Value |
|---------|--------|
| Name | e.g. `hse-app-service-frontend` |
| Runtime | **Node 24 LTS** |
| OS | **Linux** |
| Plan | e.g. `hse-frontend-asp` (B1 Dev/Test) |

Connect GitHub: `develepor04/hse_app_service_frontend` → branch `main`.

### 3.2 How deployment works (important)

GitHub Actions **builds** the Vite app in CI, then deploys a **Node package** shaped like:

```text
deploy/
  package.json      # from azure-package.json (Oryx detects Node)
  server.js         # static + SPA fallback server
  dist/
    index.html
    assets/
```

Workflow file: `.github/workflows/main_hse-app-service-frontend.yml`

Repo files used for the deploy package:

- `server.js` — small Node HTTP server that serves `dist/` and falls back to `index.html` for SPA routes (e.g. `/auth/login`)
- `azure-package.json` — copied to `deploy/package.json` so Azure/Oryx sees a Node app (`npm start` → `node server.js`)

Do **not** put `startup-command` in `azure/webapps-deploy@v3` when using **publish-profile** auth — it is unsupported and fails the job. Set startup in the Azure Portal instead (see §3.3 and §3.6).

### 3.3 Startup command (Portal) — use `node server.js`

**Configuration → Stack settings → Startup command:**

```text
node server.js
```

This is required. Azure must run a Node process that listens on `PORT` and serves the Vite build. Do **not** leave startup empty, and do **not** rely only on `npx serve` without shipping a real Node entrypoint in the package.

Optional app setting:

| Name | Value |
|------|--------|
| `WEBSITE_NODE_DEFAULT_VERSION` | `24.x` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `0` (build is done in GitHub Actions) |

`VITE_API_URL` is baked in at **build time** in the workflow (points at the backend App Service `/api/v1`). To change the API URL, update the workflow env and redeploy.

### 3.4 CORS on backend (must add frontend URL)

After the frontend App Service exists, open the **backend** App Service → **Configuration** / **Environment variables** → **+ Add** (the setting may not exist yet):

| Name | Value |
|------|--------|
| `ALLOWED_ORIGINS` | `https://hse-app-service-frontend-gjgqh3ffgrghgddc.uksouth-01.azurewebsites.net,https://dashboard.ehsera.com,http://localhost:5173,http://localhost:3000` |
| `FRONTEND_BASE_URL` | `https://hse-app-service-frontend-gjgqh3ffgrghgddc.uksouth-01.azurewebsites.net` |

**Apply** → **Restart** the backend.

Without this, login from the Azure frontend fails in the browser with CORS / `No 'Access-Control-Allow-Origin'`. The frontend API URL is already correct (built as `VITE_API_URL` in GitHub Actions); the fix is always on the **backend** allow-list.

### 3.5 Verify frontend

Open:

```text
https://<frontend-host>/auth/login
```

You should see the EHSERA login page (not `hostingstart.html` and not a directory listing).

### 3.6 Lessons learned — why Actions failed and why we use `node server.js`

Future developers should **not** “simplify” the frontend deploy back to shipping only `dist/`. That caused the original outage. History:

#### What broke

1. **Deploying static files only (`dist/`)**  
   GitHub Actions built Vite successfully, then uploaded only compiled HTML/JS/CSS. Azure App Service / Oryx then failed with messages like:
   - `Could not detect any platform in the source directory`
   - `Couldn't detect a version for the platform 'nodejs'`  
   Result: `wwwroot` kept the default **`hostingstart.html`** (or a directory listing), and the React app never ran.

2. **Deploying the entire repo (including `node_modules`)**  
   ZIP / OneDeploy tried to package a huge tree, often failed, and sometimes aborted with:
   - `Deployment has been stopped due to SCM container restart`  
   That usually happens when someone changes App Settings / Startup / Restart **while** a deploy is running. **Never do management operations during an active GitHub deploy.**

3. **Putting `startup-command` inside the GitHub Action**  
   With `azure/webapps-deploy@v3` + **publish-profile** auth, this fails:
   - `startup-command is not a valid input for Windows web app or with publish-profile auth scheme`  
   Fix: remove it from the YAML. Set **Startup command** only in the **Azure Portal** (or via Azure CLI / ARM), after or between deploys — not in the Action input.

4. **Running `npm install` again in the App Service startup command**  
   Conflicted with Oryx’s own install (`npm error Tracker "idealTree" already exists`) and made startups slow/flaky. Build belongs in GitHub Actions; runtime should only start the server.

#### What fixed it (keep this design)

| Piece | Why it exists |
|-------|----------------|
| Build in GitHub Actions (`npm ci` + `vite build`) | Reliable Node toolchain; no build on the App Service |
| Deploy package = `package.json` + `server.js` + `dist/` | Oryx detects Node; App Service has a real process to start |
| Portal startup = **`node server.js`** | Starts the server that serves static files + SPA fallback on Azure’s `PORT` |
| No `startup-command` in the workflow YAML | Avoids publish-profile Action failure |
| `SCM_DO_BUILD_DURING_DEPLOYMENT=0` | Avoids a second, conflicting build on Azure |

#### Do not “fix” by reverting to these

- Deploying only `dist/` and hoping Azure serves it like a static web host (this App Service is Node-based).
- Adding `startup-command:` back into `webapps-deploy` when using publish-profile.
- Putting `npm install && npm run build` in the Portal startup command.
- Changing Configuration while Actions is deploying.

---

## 4. Operational checklist

### First-time go-live

1. Create MySQL Flexible Server + firewall + database.
2. Run backend migrations against Azure MySQL.
3. Create backend App Service + identity + app settings + startup.
4. Deploy backend from GitHub; confirm `/health` and `/docs`.
5. Create frontend App Service; set startup `node server.js`.
6. Deploy frontend from GitHub; confirm `/auth/login`.
7. On the **backend**, **+ Add** `ALLOWED_ORIGINS` (and `FRONTEND_BASE_URL`) with the live frontend URL — then Restart backend.
8. Create at least one superadmin user in Azure MySQL.

### Safe deploy practices

- Do **not** change App Settings / Restart / Startup while a GitHub deploy is running (causes SCM restart and failed ZIP deploy).
- Prefer building frontend in CI; avoid `npm install` in the App Service startup command.
- Keep `.env` out of Git; use App Settings / Key Vault for secrets.
- Rotate any password that was pasted into chat or tickets.

### Useful Azure blades

| Need | Where |
|------|--------|
| App logs | App Service → **Log stream** |
| Deploy status | App Service → **Deployment Center** + GitHub **Actions** |
| MySQL firewall | MySQL server → **Networking** |
| Env vars | App Service → **Configuration** → Application settings |

---

## 5. Local development (reference)

### Backend

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```powershell
cd FrontendNew
# .env: VITE_API_URL=http://localhost:8000/api/v1
npm install
npx vite --host 0.0.0.0 --port 5173
```

- Frontend: http://localhost:5173/  
- Backend: http://localhost:8000/docs  

---

## 6. Cost notes (Dev/Test order of magnitude)

| Resource | Typical Dev/Test |
|----------|------------------|
| MySQL Flexible B1ms + storage | ~USD 15–20 / month |
| App Service B1 (each) | billed per plan (frontend + backend may share or use separate plans) |

Stop or delete unused Dev/Test resources to avoid ongoing charges.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Frontend shows `hostingstart.html` | Deploy never succeeded / package was static-only | Check GitHub Actions; redeploy package with `package.json` + `server.js` + `dist/`; Portal startup `node server.js` |
| Directory listing of `wwwroot` | No Node process / missing `index.html` at expected path | Confirm `server.js` running; package must have `dist/index.html` |
| `Could not detect platform nodejs` | Deployed static files only | Include `package.json` + `server.js` + `dist/` (see §3.6) |
| `startup-command is not a valid input` | Passed in Actions with publish-profile | Remove from YAML; set **Startup command** in Portal to `node server.js` |
| Deploy stopped / SCM container restart | Settings changed during deploy | Wait for Action to finish; do not restart/edit config mid-deploy |
| `Tracker "idealTree" already exists` | `npm install` in startup + Oryx install | Startup must be `node server.js` only; build in CI |
| Backend `/` → Not Found | No root route | Use `/health` or `/docs` |
| Backend DB connection fails | Firewall / SSL / bad URL | Allow Azure services; `?ssl=true`; encode password |
| Login works locally, not on Azure | Users only in local DB | Seed/create users on Azure MySQL |
| CORS errors in browser / `No Access-Control-Allow-Origin` | Frontend URL missing from backend `ALLOWED_ORIGINS` (setting may not exist yet) | Backend → **+ Add** `ALLOWED_ORIGINS` with the frontend `https://….azurewebsites.net` origin; Apply + Restart |

See **§3.6** for the full frontend deploy post-mortem and the rules future developers must keep.

---

*Last updated from the HSE Azure bootstrap (MySQL Flexible Server + dual App Services + GitHub Actions), including frontend deploy lessons (`node server.js`).*
