# Notebook VPS Deployment

## Stack

- `nginx` reverse proxy
- `frontend` Next.js standalone container
- `backend` Django + Gunicorn container
- `worker` execution job processor
- `postgres` production database
- `redis` queue/cache service

## 1. Prepare the VPS

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

Reconnect after adding the Docker group.

## 2. Configure environment

Copy `backend/.env.example` to `backend/.env` and fill in:

- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DB_*`
- `REDIS_URL`

For the frontend, export:

```bash
export NEXT_PUBLIC_API_URL=https://your-domain.com/api
export INTERNAL_API_URL=http://backend:8000
export NEXT_PUBLIC_ECOSYSTEM_CORE_URL=https://core.example.com/api
export NEXT_PUBLIC_SCIENCE_URL=https://science.example.com/
export NEXT_PUBLIC_MATH_URL=https://math.example.com/laboratory
export NEXT_PUBLIC_NOTEBOOK_URL=https://notebook.example.com/workspace
export NEXT_PUBLIC_WRITER_URL=https://writer.example.com/documents
export NEXT_PUBLIC_MATH_OBJECT_URL=https://math.example.com/laboratory
export NEXT_PUBLIC_NOTEBOOK_OBJECT_URL=https://notebook.example.com/workspace
export NEXT_PUBLIC_WRITER_OBJECT_URL=https://writer.example.com/new
export NEXT_PUBLIC_SCIENCE_OBJECT_URL=https://science.example.com/projects
export POSTGRES_DB=notebook
export POSTGRES_USER=notebook
export POSTGRES_PASSWORD=change-me

# Optional only for a protected Jupyter deployment. Leave unset to use the
# browser-local Pyodide runtime during the pre-auth stage.
# export NEXT_PUBLIC_JUPYTER_URL=https://jupyter.example.com/
# export NEXT_PUBLIC_JUPYTER_KERNEL=python3
```

## 3. Launch

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## 4. TLS

Recommended approach:

1. Put Cloudflare or a managed load balancer in front.
2. Or terminate TLS with Caddy/Traefik instead of the included plain HTTP nginx file.

If you terminate TLS upstream, keep `DJANGO_SECURE_SSL_REDIRECT=True`.

## 5. Backups

PostgreSQL backup example:

```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > notebook-$(date +%F).sql
```

Persist these volumes:

- `postgres_data`
- `backend_media`
- `backend_static`
- `redis_data`

## 6. Restore drill

```bash
cat notebook-2026-06-24.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Then restart backend and worker:

```bash
docker compose -f docker-compose.prod.yml restart backend worker
```

## 7. Upgrade flow

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Smoke checklist

1. Open the site and confirm homepage loads.
2. Sign in as a beta writer.
3. Create a notebook and save it.
4. Run one compute block and confirm execution history appears.
5. Create a checkpoint and restore it.
6. Verify `/healthz` returns `ok`.
7. From Math, send one Scientific Object to Notebook and Writer; confirm the
   target imports the exact payload and the relay record is deleted.
