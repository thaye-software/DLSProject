# Microservices

Node/TypeScript services, one folder each with a `Dockerfile` and a `README.md` (interface, env) or contract file. Contracts: [`docs/contracts/`](docs/contracts/README.md).

| Service | Folder | Store | Compose port | k8s NodePort |
|---|---|---|---|---|
| Orders | `orders/` | Postgres | 3000 | 30000 |
| Auth | `auth/` | none | 3001 | 30001 |
| Catalog | `catalog/` | Postgres | 3002 | 30002 |
| Search | `search/` | MongoDB + Redis | 3003 | 30003 |
| Messaging | `messaging/` | MongoDB | 3004 | 30004 |
| Users | `users/` | Postgres | 3005 | 30005 |
| Payment | `payments/` | none | 3006 | 30006 |
| Notif | `emails/` | none | 3007 | 30007 |
| RabbitMQ | | | 5672, UI 15672 | 30672, UI 31672 |

Every service answers `GET /health` with `{"status":"ok"}`.

Commands are the same on macOS and Windows unless shown twice. On Windows, the Terminal app opens PowerShell (the prompt starts with `PS`). On macOS, use Terminal (zsh).

## Docker Compose

Builds the images locally. Needs Docker with Compose 2.20+. From `microservices/`, create the `.env` files (existing ones are kept):

macOS:

```bash
cp -n .env.example .env
for s in orders payments emails search messaging users auth; do cp -n $s/.env.example $s/.env; done
```

Windows:

```powershell
if (-not (Test-Path .env)) { cp .env.example .env }
foreach ($s in 'orders','payments','emails','search','messaging','users','auth') { if (-not (Test-Path $s/.env)) { cp $s/.env.example $s/.env } }
```

Then edit them:

- Run without external accounts: `PAYMENT_PROVIDER=fake` (payments), `MAILER=fake` (emails), `IDENTITY_PROVIDER=fake` (users), `TOKEN_VERIFIER=fake` (auth).
- `INTERNAL_JWT_SECRET`: the same value of 32+ characters in orders, catalog, payments, users and auth.
- `SUPABASE_WEBHOOK_SECRET` (users): 32+ characters.
- Catalog has no example: create `catalog/.env` with `PORT=3002` and `INTERNAL_JWT_SECRET`.

```bash
docker compose up --build -d
docker compose ps
```

All services should be `healthy`. Stop with `docker compose down`, and add `-v` to wipe the databases.

Windows only: `scripts/start-stack.ps1` starts Docker Desktop, creates the missing `.env` files for orders, payments, emails and catalog in fake mode, starts the stack and waits for health. Add `-Rebuild` after code changes.

To skip a service and its database, set its `START_*` to `false` in `.env` (`START_CATALOG`, `START_ORDERS`, `START_PAYMENT`, `START_NOTIF`, `START_SEARCH`, `START_MESSAGING`, `START_USERS`, `START_AUTH`). Keep `COMPOSE_PROFILES=true`, or only RabbitMQ starts.

## Kubernetes (Docker Desktop, single node)

Pulls `ghcr.io/thaye-software/dlsproject-<folder>:latest`, which CI publishes on every push to `dev` or `main`. Nothing is built locally. All services run in fake mode, so no `.env` files or external accounts are needed.

- First install (Windows): [`kubernetes/softwareToInstall.txt`](../kubernetes/softwareToInstall.txt). On macOS, turn on Kubernetes in Docker Desktop; it installs `kubectl`.
- Step-by-step walkthrough with expected output: [`kubernetes/setupguide.txt`](../kubernetes/setupguide.txt).

Deploy everything, monitoring included, from the repo root:

```bash
kubectl apply -k kubernetes
kubectl get pods -A
```

[`kubernetes/kustomization.yaml`](../kubernetes/kustomization.yaml) lists every manifest; add new files there. The order does not matter: each app pod waits for its database and RabbitMQ, and pods restart until the services they call answer. The first start takes several minutes while images download.

One service only: `kubectl apply -f kubernetes/<folder>`. Newest image of a service: `kubectl rollout restart deployment/<name>`.

Remove everything, including the stored data: `kubectl delete -k kubernetes`.

Check the stack: on Windows paste [`kubernetes/verifykubernetes.txt`](../kubernetes/verifykubernetes.txt) into PowerShell (ends with `ALL OK`); on macOS check that `kubectl get pods -A` shows every pod `1/1 Running` and that `curl http://localhost:<NodePort>/health` returns `{"status":"ok"}`.

### Monitoring (logs)

Included in `kubectl apply -k kubernetes`. Promtail reads every pod's stdout and sends it to Loki; Grafana shows it at http://localhost:30300 (admin / admin), dashboard DLS → Service logs. Details and queries: [`kubernetes/monitoringguide.txt`](../kubernetes/monitoringguide.txt).

Resource usage: `kubectl top node`, `kubectl get hpa`.

## Tests

In a service folder: `npm ci`, then `npm run test:unit`. `npm run test:integration` needs Docker (Testcontainers).
