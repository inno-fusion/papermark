<div align="center">
  <img src="public/_static/papermark-logo.svg" alt="DocRoom Logo" width="280" />
  <h3>Self-Hosted Document Sharing Platform</h3>
  <p>Share documents securely with built-in analytics, custom domains, and data rooms.</p>
</div>

<br/>

<div align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#tech-stack">Tech Stack</a>
</div>

<br/>

<div align="center">

![License](https://img.shields.io/badge/license-AGPLv3-purple)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![Self Hosted](https://img.shields.io/badge/self--hosted-100%25-green)

</div>

---

## Overview

DocRoom is a fully self-hosted document sharing platform forked from [Papermark](https://github.com/mfts/papermark). This fork removes all external SaaS dependencies, enabling true air-gapped deployments with Docker.

### What's Different From Papermark?

| Component | Papermark (SaaS) | DocRoom (Self-Hosted) |
|-----------|------------------|----------------------|
| Background Jobs | Trigger.dev Cloud | BullMQ + Redis |
| Analytics | Tinybird | PostgreSQL |
| Webhooks | QStash (Upstash) | BullMQ Worker |
| Rate Limiting | Upstash Redis | Local Redis |
| Email | Resend only | SMTP or Resend |
| File Storage | Vercel Blob | S3 / MinIO |
| Limits | Plan-based | **Unlimited** |

---

## Features

### Document Management
- **Secure Sharing** - Share documents via custom links with password protection
- **Version Control** - Track document versions and updates
- **Multi-format Support** - PDF, Office documents, images, videos, CAD files

### Analytics & Tracking
- **Page-by-Page Analytics** - See exactly which pages viewers spend time on
- **Viewer Insights** - Geographic location, device, browser information
- **Real-time Notifications** - Get notified when documents are viewed

### Data Rooms
- **Virtual Data Rooms** - Secure spaces for due diligence and deal rooms
- **Granular Permissions** - Control access at folder and document level
- **Audit Trails** - Complete activity logging

### Customization
- **Custom Domains** - Use your own domain for sharing links
- **White Labeling** - Custom branding, logos, and colors
- **Watermarking** - Dynamic watermarks on documents

### Self-Hosted Benefits
- **No Limits** - Unlimited documents, links, users, and data rooms
- **Data Ownership** - All data stays on your infrastructure
- **Air-Gapped** - No external service dependencies

---

## Architecture

```
                            ┌─────────────────────────────┐
                            │      INTERNET / USERS       │
                            └──────────────┬──────────────┘
                                           │
                                           ▼
                            ┌─────────────────────────────┐
                            │      REVERSE PROXY          │
                            │    (Nginx / Traefik)        │
                            │      Port 443 / 80          │
                            └──────────────┬──────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│      DOCROOM APP        │  │       MINIO (S3)        │  │      GOTENBERG          │
│      Port 3000          │  │     Port 9000/9001      │  │      Port 3001          │
└───────────┬─────────────┘  └─────────────────────────┘  └─────────────────────────┘
            │
            │ Internal Docker Network
            │
┌───────────┴─────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐    │
│   │     POSTGRESQL      │  │       REDIS         │  │    DOCROOM WORKER   │    │
│   │     Port 5432       │  │     Port 6379       │  │    (Background)     │    │
│   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘    │
│                              INTERNAL ONLY                                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Services & Components

### Core Services

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| App Server | Next.js 14 | Main application, API routes, SSR | 3000 |
| Database | PostgreSQL 16 | Primary data store, analytics | 5432 |
| Cache & Queues | Redis 7 | Job queues, rate limiting, caching | 6379 |
| Background Workers | BullMQ | Async job processing | - |
| Object Storage | MinIO / S3 | Documents, images, assets | 9000 |
| PDF Conversion | Gotenberg 8 | Office → PDF conversion | 3001 |

### Background Workers (BullMQ)

| Worker | Purpose | Concurrency |
|--------|---------|-------------|
| `pdf-to-image` | Convert PDF pages to images for viewing | 5 |
| `file-conversion` | Office/CAD/Keynote → PDF via Gotenberg | 3 |
| `video-optimization` | Transcode videos to MP4 (ffmpeg) | 2 |
| `export-visits` | Generate CSV/Excel analytics exports | 3 |
| `scheduled-email` | Send delayed/scheduled emails | 5 |
| `dataroom-notification` | Notify viewers of dataroom updates | 5 |
| `conversation-notification` | Chat/comment notifications | 5 |
| `webhook-delivery` | Reliable webhook delivery with retries | 10 |
| `cleanup` | Cron job for expired data cleanup | 1 |
| `pause-resume` | Billing pause/resume notifications | 2 |
| `automatic-unpause` | Auto-resume paused subscriptions | 1 |

### Analytics Tables (PostgreSQL)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `page_views` | Document page view tracking | documentId, viewId, duration, pageNumber |
| `video_views` | Video playback events | documentId, eventType, startTime, endTime |
| `click_events` | Link clicks within documents | documentId, href, pageNumber |
| `link_click_events` | Initial link access tracking | linkId, country, device, browser |
| `webhook_events` | Webhook delivery logs | webhookId, httpStatus, responseBody |

### File Conversion Support

| Input Format | Output | Converter |
|--------------|--------|-----------|
| PDF | Page Images | MuPDF (built-in) |
| DOCX, DOC | PDF | Gotenberg (LibreOffice) |
| PPTX, PPT | PDF | Gotenberg (LibreOffice) |
| XLSX, XLS | PDF | Gotenberg (LibreOffice) |
| Keynote | PDF | Gotenberg |
| DWG, DXF (CAD) | PDF | Gotenberg |
| MP4, MOV, AVI | MP4 (H.264) | ffmpeg |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Domain with DNS configured (for production)
- S3-compatible storage (MinIO included, or use AWS S3)

### 1. Clone & Configure

```bash
git clone https://github.com/0xMetaLabs/docroom.git
cd docroom

# Copy environment template
cp .env.docker.example .env
```

### 2. Edit Environment Variables

```bash
# Required: Edit these values
nano .env
```

Key variables to configure:

```env
# URLs
NEXT_PUBLIC_BASE_URL=https://docs.yourdomain.com
NEXT_PUBLIC_APP_DOMAIN=docs.yourdomain.com

# Database
POSTGRES_PASSWORD=your-secure-password

# Auth
NEXTAUTH_SECRET=your-secret-key  # Generate: openssl rand -hex 32

# Storage (S3/MinIO)
NEXT_PRIVATE_UPLOAD_BUCKET=docroom
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID=your-access-key
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY=your-secret-key
NEXT_PRIVATE_UPLOAD_ENDPOINT=https://s3.yourdomain.com  # For MinIO

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASSWORD=your-password
EMAIL_FROM=DocRoom <noreply@yourdomain.com>
```

### 3. Start with Docker Compose

```bash
# Build and start all services
docker-compose -f docker-compose-prod.yml up -d

# View logs
docker-compose -f docker-compose-prod.yml logs -f

# Check status
docker-compose -f docker-compose-prod.yml ps
```

### 4. Access the Application

- **App:** http://localhost:3000 (or your configured domain)
- **First user to sign up becomes admin**

---

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | `secure-password-123` |
| `NEXTAUTH_SECRET` | Auth encryption key | `openssl rand -hex 32` |
| `NEXT_PUBLIC_BASE_URL` | Public app URL | `https://docs.example.com` |
| `NEXT_PUBLIC_APP_DOMAIN` | App domain | `docs.example.com` |
| `NEXT_PRIVATE_UPLOAD_BUCKET` | S3 bucket name | `docroom-uploads` |
| `NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID` | S3 access key | - |
| `NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY` | S3 secret key | - |
| `EMAIL_FROM` | Sender email address | `DocRoom <no-reply@example.com>` |
| `INTERNAL_API_KEY` | Worker auth key | `openssl rand -hex 32` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PRIVATE_UPLOAD_ENDPOINT` | S3 endpoint (for MinIO) | AWS default |
| `GOOGLE_CLIENT_ID` | Google OAuth | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | - |
| `SLACK_CLIENT_ID` | Slack integration | - |
| `SLACK_CLIENT_SECRET` | Slack integration | - |
| `NEXT_PUBLIC_DISABLE_SIGNUP` | Disable new signups | `false` |
| `GOTENBERG_USERNAME` | Gotenberg basic auth | - |
| `GOTENBERG_PASSWORD` | Gotenberg basic auth | - |

### Email Configuration

**Option 1: SMTP**
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASSWORD=your-password
```

**Option 2: Resend**
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) |
| **ORM** | [Prisma](https://prisma.io/) |
| **Authentication** | [NextAuth.js](https://next-auth.js.org/) |
| **Job Queue** | [BullMQ](https://docs.bullmq.io/) |
| **Cache** | [Redis](https://redis.io/) (ioredis) |
| **Object Storage** | S3 / [MinIO](https://min.io/) |
| **PDF Conversion** | [Gotenberg](https://gotenberg.dev/) |
| **Video Processing** | [ffmpeg](https://ffmpeg.org/) |
| **Email** | SMTP (nodemailer) / [Resend](https://resend.com/) |
| **Containerization** | [Docker](https://www.docker.com/) |

---

## Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Set up database
npm run dev:prisma

# Start development server (app + workers)
npm run dev:all
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run dev:all` | Start app + workers concurrently |
| `npm run workers` | Start BullMQ workers only |
| `npm run build` | Build for production |
| `npm run start` | Start production server |

---

## Documentation

For detailed documentation, see:

- **[SELF_HOSTING_GUIDE.md](./SELF_HOSTING_GUIDE.md)** - Complete self-hosting guide with all changes documented

---

## License

This project is licensed under the [AGPLv3 License](LICENSE).

---

## Credits

This is a fork of [Papermark](https://github.com/mfts/papermark) by [mfts](https://github.com/mfts).

**Modifications by [0xMetaLabs](https://github.com/0xMetaLabs):**
- Removed Trigger.dev → BullMQ workers
- Removed Tinybird → PostgreSQL analytics
- Removed Hanko passkeys
- Made QStash optional → BullMQ webhooks
- Added SMTP email support
- Added Redis unification (ioredis)
- Added MinIO/S3 compatibility
- Removed all plan limitations
- Full Docker containerization
