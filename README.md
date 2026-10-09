# TraceX — Student Learning Intelligence Platform

TraceX consists of a React + Vite frontend, a FastAPI backend, a MySQL database, and a Chromium extension for browser activity telemetry.

## Repository layout

- `frontend/` — React + Vite user interface (deploy to Vercel)
- `backend/` — FastAPI REST API (deploy to a Python-capable host such as Render)
- `extension/` — Chrome/Chromium Manifest V3 extension
- MySQL — use a managed, internet-accessible database for a public deployment

## Run locally (Windows PowerShell)

### 1. Configure the backend

Create `backend/.env` from `backend/.env.example`, then set your actual local MySQL credentials and a strong random `SECRET_KEY`. Do not commit `.env`.

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend health check: `http://127.0.0.1:8000/api/health`  
API documentation: `http://127.0.0.1:8000/docs`

### 2. Run the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

For local development, the frontend defaults to `http://127.0.0.1:8000`. Set `VITE_API_BASE_URL` to override it.

## Deployment plan

### A. MySQL database

Use a managed MySQL service that allows connections from your backend host. Create the `trace_x` database, import your schema/data as appropriate, and configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in the backend host's environment variables. Do not use `localhost` for a hosted database.

Before public deployment, verify that schema creation/migrations are safe and that you have a database backup.

### B. FastAPI backend

Deploy the `backend/` directory to a Python-capable host (for example, Render).

- Build/install command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SECRET_KEY`, `FRONTEND_URL`.
- `FRONTEND_URL` should be the exact deployed Vercel URL, such as `https://your-project.vercel.app`.

Check `https://YOUR-BACKEND-HOST/api/health` and `/docs` after deployment.

### C. React frontend on Vercel

1. Push this project to a private GitHub repository after checking that no secrets or personal data are committed.
2. In Vercel, import the repository.
3. Set **Root Directory** to `frontend`.
4. Framework preset: **Vite**.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Add environment variable `VITE_API_BASE_URL` with the full deployed backend URL, for example `https://your-backend-host.onrender.com`.
8. Redeploy after changing environment variables.

The `vercel.json` rewrite supports client-side React Router routes.

### D. Browser extension

The extension currently targets a local backend and local dashboard. Before expecting the extension to work for users on the public site, update its API/dashboard URLs and `extension/manifest.json` host permissions to use your actual HTTPS backend and Vercel domains. Then reload the unpacked extension in Chrome and test telemetry end-to-end. Do not publish the extension until this is configured.

## Pre-demo checklist

- [ ] Replace any leaked database credentials and JWT secret.
- [ ] Confirm the hosted MySQL schema matches the current SQLAlchemy models.
- [ ] Confirm backend `/api/health` reports a database connection.
- [ ] Confirm Vercel frontend can log in and load real API data.
- [ ] Test registration/login, courses/topics, notes/resources, study sessions, analytics, and extension telemetry.
- [ ] Remove personal browsing data and test uploads from the demo database.
- [ ] Do not expose debug traces or secrets in public logs.
- [ ] Keep a database backup before applying migrations.

## Privacy and production notes

TraceX handles browsing activity, which can be sensitive. Obtain clear consent, provide a way to pause/stop tracking, and avoid collecting unrelated browsing data. The current code is prepared for deployment configuration but still requires a full production security review before public use.
