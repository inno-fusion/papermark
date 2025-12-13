# Papermark Dependencies - Quick Reference Guide

**Last Updated:** December 13, 2024

## 📑 Quick Links

- **Full Analysis:** [DEPENDENCIES_ANALYSIS.md](DEPENDENCIES_ANALYSIS.md)
- **Repository:** https://github.com/mfts/papermark
- **Tech Stack:** Next.js 14, Prisma, PostgreSQL

---

## 🎯 TL;DR - Critical Dependencies Summary

### Must-Have Services (Cannot run without)

| Service | Current | Local Alternative | Effort |
|---------|---------|-------------------|--------|
| PostgreSQL | Vercel/Neon | Docker PostgreSQL | ⭐ Easy |
| File Storage | S3/Vercel Blob | MinIO | ⭐⭐ Medium |
| Email | Resend | SMTP/Nodemailer | ⭐⭐⭐ High |
| Background Jobs | Trigger.dev | BullMQ | ⭐⭐⭐⭐ Very High |
| Cache/Queue | Upstash Redis | Redis | ⭐⭐ Medium |

### Optional Services (Can disable)

- **Analytics:** Tinybird, PostHog, Jitsu → Disable or ClickHouse
- **Payments:** Stripe → Test mode or mock
- **AI:** OpenAI → Disable or Ollama
- **OAuth:** Google, LinkedIn → Email only
- **Integrations:** Slack, Notion → Disable

---

## 🚀 Quick Start Commands

### Minimal Local Setup (30 minutes)

```bash
# 1. Start services
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Setup database
npx prisma generate
npx prisma migrate deploy

# 4. Create MinIO buckets
docker exec papermark-minio sh -c "
  mc alias set local http://localhost:9000 minioadmin minioadmin123
  mc mb local/papermark-uploads --ignore-existing
"

# 5. Start app
npm run dev
```

**Access Points:**
- App: http://localhost:3000
- Mailhog: http://localhost:8025
- MinIO Console: http://localhost:9001

---

## 📦 Environment Variables Checklist

### Required (Minimum to run)

```bash
# Database
POSTGRES_PRISMA_URL="postgresql://..."
POSTGRES_PRISMA_URL_NON_POOLING="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Storage
NEXT_PUBLIC_UPLOAD_TRANSPORT="s3"
NEXT_PRIVATE_UPLOAD_BUCKET="papermark-uploads"
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID="minioadmin"
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY="minioadmin123"
NEXT_PRIVATE_UPLOAD_DISTRIBUTION_HOST="localhost:9000"
```

### Optional (For full functionality)

```bash
# Email
RESEND_API_KEY="re_..." OR SMTP_HOST="localhost"

# Background Jobs
TRIGGER_SECRET_KEY="tr_..." OR run BullMQ workers

# Analytics
TINYBIRD_TOKEN="p.ey..." (optional)

# Payments
STRIPE_SECRET_KEY="sk_test_..." (test mode)

# AI
OPENAI_API_KEY="sk-..." (optional)
```

---

## 🔧 Docker Compose Quick Reference

### Start All Services
```bash
docker-compose up -d
```

### Start Specific Service
```bash
docker-compose up -d postgres
docker-compose up -d minio
docker-compose up -d redis
```

### Check Logs
```bash
docker-compose logs -f postgres
docker-compose logs -f minio
```

### Stop All
```bash
docker-compose down
```

### Reset Everything
```bash
docker-compose down -v  # WARNING: Deletes all data!
```

---

## 📊 Service Ports Reference

| Service | Port(s) | Purpose |
|---------|---------|---------|
| Next.js | 3000 | Main application |
| PostgreSQL | 5432 | Database |
| MinIO API | 9000 | S3-compatible storage |
| MinIO Console | 9001 | Web UI |
| Redis | 6379 | Cache/Queue |
| Mailhog SMTP | 1025 | Email sending |
| Mailhog UI | 8025 | Email viewer |
| ClickHouse (optional) | 8123, 9000 | Analytics |

---

## 🐛 Common Issues & Fixes

### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs papermark-postgres

# Restart
docker-compose restart postgres
```

### MinIO Upload Failed
```bash
# Check buckets exist
docker exec papermark-minio mc ls local/

# Create bucket
docker exec papermark-minio mc mb local/papermark-uploads

# Check permissions
docker exec papermark-minio mc anonymous set download local/papermark-uploads
```

### Redis Connection Error
```bash
# Test Redis
docker exec papermark-redis redis-cli ping
# Should return: PONG

# Restart
docker-compose restart redis
```

### Email Not Sending (Mailhog)
```bash
# Check Mailhog is running
curl http://localhost:8025

# Check SMTP port
telnet localhost 1025

# Verify env vars
SMTP_HOST=localhost
SMTP_PORT=1025
```

---

## 🎯 Development Workflows

### Daily Development
```bash
# Start services (if not running)
docker-compose up -d

# Start Next.js
npm run dev

# Watch logs
docker-compose logs -f
```

### Database Changes
```bash
# Create migration
npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: Deletes data)
npx prisma migrate reset

# Prisma Studio (DB viewer)
npx prisma studio
```

### File Upload Testing
```bash
# MinIO Console: http://localhost:9001
# Login: minioadmin / minioadmin123
# Browse uploaded files in buckets
```

### Email Testing
```bash
# Mailhog UI: http://localhost:8025
# All sent emails appear here
# Test email sending from app
```

---

## 📋 Feature Availability Matrix

| Feature | Minimal Setup | Hybrid | Full Self-Hosted |
|---------|--------------|--------|------------------|
| User Auth (Email) | ✅ | ✅ | ✅ |
| User Auth (OAuth) | ❌ | ✅ | ⚠️ Optional |
| Document Upload | ✅ | ✅ | ✅ |
| PDF Viewer | ✅ | ✅ | ✅ |
| Link Sharing | ✅ | ✅ | ✅ |
| View Tracking (Basic) | ✅ | ✅ | ✅ |
| Real-time Analytics | ❌ | ✅ | ⚠️ ClickHouse |
| Email Notifications | ✅ Mailhog | ✅ Resend | ✅ SMTP |
| File Conversion | ❌ | ✅ Trigger.dev | ⚠️ BullMQ |
| Video Optimization | ❌ | ✅ Trigger.dev | ⚠️ BullMQ |
| AI Chat | ❌ | ✅ OpenAI | ⚠️ Ollama |
| Payments | ❌ | ✅ Stripe | ✅ Stripe Test |
| Webhooks | ❌ | ✅ QStash | ⚠️ BullMQ |
| Integrations | ❌ | ⚠️ Optional | ❌ |

**Legend:**
- ✅ Fully Working
- ⚠️ Requires Additional Setup
- ❌ Not Available

---

## 💰 Cost Comparison

### Current Production (SaaS)
- **Free Tier:** $0/mo (limited features)
- **Typical Usage:** $50-500/mo
- **High Volume:** $500-1000+/mo

### Self-Hosted
- **Minimal (Dev Only):** $0/mo
- **Hybrid (Recommended):** $20-50/mo
- **Full Self-Hosted:** $50-150/mo

**Savings:** 60-92% cost reduction

---

## 🔐 Security Checklist

### Development
- [ ] Use strong `NEXTAUTH_SECRET`
- [ ] Don't commit `.env` files
- [ ] Change default MinIO credentials
- [ ] Use localhost-only bindings

### Production
- [ ] Use HTTPS (Let's Encrypt)
- [ ] Configure firewall (ufw/iptables)
- [ ] Enable Redis password
- [ ] Use strong PostgreSQL password
- [ ] Set up backups
- [ ] Configure monitoring
- [ ] Use environment-specific secrets
- [ ] Enable CORS properly
- [ ] Set up rate limiting

---

## 📈 Performance Tips

### Database
- Use connection pooling (PgBouncer)
- Add indexes for common queries
- Regular `VACUUM` and `ANALYZE`

### Storage (MinIO)
- Use CDN for static assets
- Enable nginx caching
- Set proper CORS headers

### Redis
- Configure maxmemory policy
- Use Redis persistence (AOF)
- Monitor memory usage

### Application
- Enable Next.js production build
- Use ISR for static pages
- Optimize images
- Enable gzip/brotli

---

## 🆘 Getting Help

### Documentation
- **Full Analysis:** [DEPENDENCIES_ANALYSIS.md](DEPENDENCIES_ANALYSIS.md)
- **Papermark Docs:** https://papermark.io/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://prisma.io/docs

### Common Resources
- MinIO Docs: https://min.io/docs
- BullMQ Docs: https://docs.bullmq.io
- PostgreSQL Docs: https://postgresql.org/docs

### Community
- GitHub Issues: https://github.com/mfts/papermark/issues
- Discord: (Check Papermark README)

---

## 🔄 Migration Paths

### From SaaS to Self-Hosted

1. **Export data** from current setup
2. **Set up local infrastructure** (PostgreSQL, MinIO)
3. **Import data** to self-hosted DB
4. **Migrate files** from Vercel Blob/S3 to MinIO
5. **Update DNS** (if custom domain)
6. **Test thoroughly**
7. **Switch traffic**

### From Local to Production

1. **Provision server** (VPS)
2. **Set up Docker Compose** on server
3. **Configure domain & SSL**
4. **Deploy code**
5. **Run migrations**
6. **Configure backups**
7. **Monitor & optimize**

---

## 🎯 Decision Tree

### Should I Self-Host?

**Self-host if:**
- ✅ Cost is a concern (saving 60-90%)
- ✅ Data sovereignty required
- ✅ You have DevOps experience
- ✅ You can invest setup time (1-6 weeks)

**Stay on SaaS if:**
- ❌ Limited technical resources
- ❌ Need guaranteed uptime (99.9%+)
- ❌ Want zero maintenance
- ❌ Scaling is unpredictable

### Which Approach?

**Minimal Dev Setup** (2-3 days)
- Just want to run locally
- Development/testing only
- Not production-ready

**Hybrid Approach** (1-2 weeks)
- Best balance
- Self-host infrastructure
- Keep complex SaaS (Trigger.dev, Tinybird)
- **Recommended for most users**

**Full Self-Hosted** (4-6 weeks)
- Maximum control
- Zero external dependencies
- Requires significant effort
- Best for experienced teams

---

## 📝 Next Steps

### For Local Development
1. Run `docker-compose up -d`
2. Copy `.env.example` to `.env.local`
3. Run `npm install && npm run dev`
4. Start building!

### For Production
1. Read full analysis: [DEPENDENCIES_ANALYSIS.md](DEPENDENCIES_ANALYSIS.md)
2. Choose approach (Minimal/Hybrid/Full)
3. Follow implementation roadmap
4. Set up monitoring & backups
5. Deploy & test

### Get Custom Implementation Help
Choose what you need:
- [ ] Docker Compose files (✅ Done - see DEPENDENCIES_ANALYSIS.md)
- [ ] Email migration code (Resend → SMTP)
- [ ] BullMQ implementation (Background jobs)
- [ ] ClickHouse setup (Analytics)
- [ ] Deployment scripts
- [ ] Monitoring setup

---

**Ready to start?** Check the full analysis for detailed implementation guides!
