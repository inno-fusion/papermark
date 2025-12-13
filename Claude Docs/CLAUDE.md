# Papermark Self-Hosting Migration Guide

## Objective

Make Papermark fully local and self-hostable with minimal external dependencies. All replacements should be Docker-based drop-in alternatives. Final goal: package the entire app as a single Docker image.

---

## Migration Status

| Dependency | Status | Replacement |
|------------|--------|-------------|
| Vercel Postgres | DONE | Local PostgreSQL (Docker) |
| Upstash Redis | PENDING | Local Redis (Docker) |
| QStash | PENDING | BullMQ + Local Redis |
| Resend | PENDING | Nodemailer (SMTP) |
| Trigger.dev | PENDING | BullMQ Workers |
| S3 Storage | KEEP | S3-compatible (MinIO optional) |
| File Conversions | PENDING | Local processing / disable unsupported |

---

## Migration Order

1. **Upstash Redis → Local Redis**
2. **QStash → BullMQ** (depends on Redis)
3. **Resend → Nodemailer**
4. **Trigger.dev → BullMQ Workers**
5. **File Conversions → Local processing**
6. **Final: Docker image packaging**

---

## Migration Principles

- One dependency at a time
- Maintain feature parity where possible
- Graceful degradation for unsupported features
- Environment variable driven configuration
- Zero breaking changes to existing API contracts

---

## Dependency Details

### 1. Upstash Redis → Local Redis

- Replace `@upstash/redis` with `ioredis`
- Docker: `redis:alpine`
- Env: `REDIS_URL=redis://localhost:6379`

### 2. QStash → BullMQ

- Replace Vercel/QStash queue with BullMQ
- Uses local Redis as backend
- Maintain same job interfaces

### 3. Resend → Nodemailer

- Replace `resend` SDK with `nodemailer`
- Support any SMTP provider
- Env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### 4. Trigger.dev → BullMQ Workers

- Move background jobs to BullMQ
- Run workers in same process or separate container
- Jobs: document processing, notifications, analytics

### 5. File Conversions

- Evaluate each conversion type
- Replace with local libraries where possible (pdf-lib, sharp, etc.)
- Disable unsupported formats with clear messaging

### 6. S3 Storage

- Keep S3-compatible interface
- Works with AWS S3, MinIO, Cloudflare R2, etc.
- Optional: add MinIO to docker-compose for fully local setup

---

## Environment Variables Template

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/papermark

# Redis
REDIS_URL=redis://localhost:6379

# Email (Nodemailer)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM=noreply@example.com

# S3 Storage
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=papermark
S3_REGION=us-east-1
```

---

## Docker Compose Structure

```yaml
services:
  app:
    build: .
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16-alpine

  redis:
    image: redis:alpine

  # Optional for local S3
  minio:
    image: minio/minio
```

---

## Current Task

Check migration status above and work on the next PENDING item in order.

---

## Notes

- Keep original implementations behind feature flags during transition
- Test thoroughly before removing old code
- Document any feature limitations in self-hosted mode
