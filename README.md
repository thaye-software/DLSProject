# DLS Project

Limited Watches, an online watch shop, migrated from a Next.js monolith to microservices orchestrated by Kubernetes on a single local node.

| Folder | Contents |
|---|---|
| `monolith/limited-watches/` | The original monolith |
| `microservices/` | The services, Docker Compose setup and contracts. **How to run: [`microservices/README.md`](microservices/README.md)** |
| `kubernetes/` | Manifests per service, monitoring (Loki, Promtail, Grafana) and step-by-step guides |
| `.github/workflows/` | CI per service: tests, security scan, image publish to GHCR |
| `docs/adr/` | Architecture decisions |

## Architecture

Frontend → API gateway (not built yet) → services over HTTP. Services talk asynchronously over RabbitMQ (one exchange per publisher) and own their datastores. Supabase handles login, Stripe payments, Resend email.

- Service boundaries, sync/async choices and events: [`CLAUDE.md`](CLAUDE.md)
- Domain terms: [`CONTEXT.md`](CONTEXT.md)
- Open decisions: [`DECISIONS.md`](DECISIONS.md)
- API and event contracts: [`microservices/docs/contracts/`](microservices/docs/contracts/README.md)
