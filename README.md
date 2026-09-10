# Notebook Platform

`Notebook` is a structured computational notebook product with typed blocks, snapshot history, queued execution jobs, and a production-ready Next.js + Django stack.

## Product shape

- `public read / authenticated write`
- typed notebook blocks instead of one generic cell model
- autosave snapshots plus named checkpoints
- queued execution jobs with persisted history
- Docker VPS deployment path for private beta

## Architecture

### Frontend

- `app/`: route shell only
- `features/notebook/core/`: session state, runtime, plugin contracts, types
- `features/notebook/ui/`: notebook workspace UI
- `lib/`: API/auth adapters and pure helpers
- `widgets/`: app shell and navbar

### Backend

- `backend/notebook/models.py`: documents, snapshots, execution records, execution jobs, imports
- `backend/notebook/views.py`: ownership-aware CRUD, restore, execute, capability discovery
- `backend/notebook/management/commands/process_execution_jobs.py`: background worker loop
- `backend/project/settings.py`: production-safe defaults, PostgreSQL/Redis wiring, upload limits

## Local development

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
backend/.venv/bin/python backend/manage.py migrate
backend/.venv/bin/python backend/manage.py runserver
```

Optional local worker:

```bash
backend/.venv/bin/python backend/manage.py process_execution_jobs --poll-interval 1.5
```

## Authentication

- JWT login: `POST /api/token/`
- token refresh: `POST /api/token/refresh/`
- current session: `GET /api/notebook/auth/session/`
- temporary guest bootstrap: `POST /api/notebook/auth/bootstrap-demo/` (pre-auth stage only)

Anonymous users can read only notebooks marked `public_read`. Write, execute, checkpoint, and restore operations require authentication and ownership.

Until product authentication is introduced, the visible workspace obtains a
temporary shared `axion-guest` session automatically so it can exercise the
real persistence and execution APIs. This is intentionally not suitable for
multi-user production and must be replaced before public launch.

## Execution model

- lightweight previews stay local in the browser
- compute submissions create queued `NotebookExecutionJob` records
- the worker processes jobs and writes `NotebookExecutionRecord` history
- stale blocks never auto-run downstream execution
- Python execution is selected through `features/notebook/core/jupyter-adapter.ts`:
  - `this-device` uses the existing Pyodide dependency in the browser;
  - `jupyter-kernel` speaks the standard Jupyter Server kernel REST/WebSocket protocol;
  - `external-server` and `hpc-cluster` remain explicit backend targets, not hidden fallbacks.
- Jupyter owns the kernel/session. Notebook owns the document, Project/Object reference, provenance, and execution history.

For a local or hosted Jupyter Server, set `NEXT_PUBLIC_JUPYTER_URL` and optionally `NEXT_PUBLIC_JUPYTER_TOKEN` / `NEXT_PUBLIC_JUPYTER_KERNEL`. Without it, the workspace uses browser-local Pyodide. The token is intentionally an explicit deployment choice and should only be exposed when the Jupyter endpoint is protected for that client.

## Production deployment

Production stack files included:

- [Dockerfile](./Dockerfile)
- [backend/Dockerfile](./backend/Dockerfile)
- [docker-compose.prod.yml](./docker-compose.prod.yml)
- [ops/nginx.conf](./ops/nginx.conf)
- [docs/deployment-vps.md](./docs/deployment-vps.md)

Services:

- Next.js standalone app
- Django + Gunicorn API
- PostgreSQL
- Redis
- execution worker
- nginx reverse proxy

For a systemd deployment, install
[`ops/axion-notebook-worker.service`](./ops/axion-notebook-worker.service)
alongside the backend service so queued jobs survive frontend restarts.

### Separate-server staging

The frontend is built with public URLs, so a deployment on a different host or
port must provide `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_ECOSYSTEM_CORE_URL`, and the `NEXT_PUBLIC_*_URL` app links before
`npm run build`. These values are intentionally not committed: each server
can point at a different API or relay host.

The current pre-auth deployment uses browser-local Pyodide for Python cells
when `NEXT_PUBLIC_JUPYTER_URL` is unset. Structured solve/graph/table jobs
are processed by the Django worker. A hosted Jupyter Server is an optional
execution boundary; do not expose a shared Jupyter token to untrusted users.
Enable it only behind an authenticated, isolated Jupyter deployment or a
server-side broker before public production.

## CI

GitHub Actions runs:

- frontend lint
- frontend test
- frontend build
- backend migrate/check/test

Workflow file: [.github/workflows/ci.yml](./.github/workflows/ci.yml)

## Extension rules

- add new product logic under `features/notebook`
- add new block kinds through the typed plugin registry
- keep route files thin
- keep backend API contracts stable for plugin consumers
- prefer new services/endpoints over adding more switch logic into the workspace
