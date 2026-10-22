# DLS Project

Limited Watches — monolith under `monolith/`, microservices under `microservices/`. Architecture notes: `CLAUDE.md`.

## Local stack (Orders, Payment, Notif, RabbitMQ)

Morning bootstrap (from the DLS-BOB / KODE workspace root):

```powershell
D:\TESTCMLDDRIVE\KODE\start-dls-stack.ps1
```

Or:

```powershell
cd microservices
.\scripts\start-stack.ps1
```

Full instructions: `D:\TESTCMLDDRIVE\KODE\README.md` (open `DLS-BOB.code-workspace` for the multi-root Cursor workspace with BOB).
