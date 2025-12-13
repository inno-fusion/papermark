# Papermark Documentation

This folder contains comprehensive documentation for understanding and self-hosting Papermark.

## 📄 Documentation Files

### [DEPENDENCIES_ANALYSIS.md](DEPENDENCIES_ANALYSIS.md)
**Complete external dependencies analysis and localization plan**

Comprehensive 50+ page guide covering:
- All 20+ external service integrations
- Complete API architecture (215 endpoints)
- Database schema (50+ models)
- Background job system (11 jobs)
- Step-by-step self-hosting guide
- Cost analysis (SaaS vs Self-hosted)
- Implementation roadmap (4-6 weeks)

**Read this for:** Complete understanding of Papermark's architecture and self-hosting strategy.

---

### [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
**Quick reference guide for developers**

Essential quick-start information:
- TL;DR dependencies summary
- 30-minute setup guide
- Environment variable checklist
- Docker Compose commands
- Common troubleshooting
- Feature availability matrix
- Development workflows

**Read this for:** Quick answers and daily development tasks.

---

## 🎯 Quick Navigation

**I want to...**

### Run Papermark Locally (Development)
→ [QUICK_REFERENCE.md - Quick Start](QUICK_REFERENCE.md#-quick-start-commands)

**Steps:**
1. Run `docker-compose up -d`
2. Copy `.env.example` to `.env.local`
3. Run `npm run dev`

**Time:** 30 minutes

---

### Understand All External Dependencies
→ [DEPENDENCIES_ANALYSIS.md - Part 1](DEPENDENCIES_ANALYSIS.md#part-1-complete-external-dependencies-flow)

**Covers:**
- Database (PostgreSQL)
- File Storage (S3/Vercel Blob)
- Email (Resend/Unsend)
- Background Jobs (Trigger.dev)
- Analytics (Tinybird, PostHog, Jitsu)
- Payments (Stripe)
- AI (OpenAI)
- Integrations (Slack, Notion, etc.)

---

### Self-Host Papermark (Production)
→ [DEPENDENCIES_ANALYSIS.md - Part 2](DEPENDENCIES_ANALYSIS.md#part-2-localization-plan---minimal-external-dependencies)

**Covers:**
- PostgreSQL → Docker
- S3/Vercel Blob → MinIO
- Resend → SMTP/Nodemailer
- Trigger.dev → BullMQ
- Tinybird → ClickHouse (optional)
- Complete Docker Compose setup
- Production deployment guide

**Time Estimates:**
- Minimal Setup: 2-3 days
- Hybrid Approach: 1-2 weeks
- Full Self-Hosted: 4-6 weeks

---

### Calculate Self-Hosting Costs
→ [DEPENDENCIES_ANALYSIS.md - Cost Analysis](DEPENDENCIES_ANALYSIS.md#cost-analysis)

**Comparison:**
- Current SaaS: $50-1000/mo
- Self-Hosted: $20-150/mo
- **Savings: 60-92%**

---

### Troubleshoot Issues
→ [QUICK_REFERENCE.md - Common Issues](QUICK_REFERENCE.md#-common-issues--fixes)

**Covers:**
- Database connection errors
- MinIO upload failures
- Redis connection problems
- Email sending issues

---

## 🗺️ Documentation Structure

```
DEPENDENCIES_ANALYSIS.md (Complete Guide)
├── Part 1: External Dependencies Flow
│   ├── 1. Critical Infrastructure (Database, Auth, Storage)
│   ├── 2. Email System (Resend, Unsend)
│   ├── 3. Background Jobs (Trigger.dev, QStash)
│   ├── 4. Caching & Rate Limiting (Redis)
│   ├── 5. Analytics (Tinybird, PostHog, Jitsu)
│   ├── 6. Payments (Stripe)
│   ├── 7. AI Services (OpenAI)
│   ├── 8. Document Processing (MuPDF, LibreOffice, ConvertAPI)
│   ├── 9. Integrations (Slack, Notion, Cal.com)
│   ├── 10. Webhooks (Outgoing & Incoming)
│   ├── 11. Infrastructure (Vercel, Edge Config)
│   └── 12. Cron Jobs
├── Part 2: Localization Plan
│   ├── Tier 1: Required (PostgreSQL)
│   ├── Tier 2: Core Functionality (Storage, Email, Jobs)
│   ├── Tier 3: Authentication (OAuth, Passkeys)
│   ├── Tier 4: Analytics (Tinybird → ClickHouse)
│   ├── Tier 5: Payments (Stripe)
│   ├── Tier 6: AI (OpenAI → Ollama)
│   ├── Tier 7: Document Processing (LibreOffice)
│   └── Tier 8: Integrations (Slack, Notion)
├── Minimal Viable Local Setup
│   ├── Complete Docker Compose
│   ├── Environment Configuration
│   └── Setup Scripts
├── Cost Analysis
│   ├── Current Production (SaaS)
│   └── Self-Hosted Setup
└── Implementation Roadmap
    ├── Phase 1: Core Infrastructure (Week 1)
    ├── Phase 2: Email System (Week 1-2)
    ├── Phase 3: Background Jobs (Week 2-3)
    ├── Phase 4: Webhook & Queue (Week 3-4)
    ├── Phase 5: Analytics (Week 4-6)
    ├── Phase 6: Document Processing (Week 5)
    ├── Phase 7: Testing (Week 6)
    └── Phase 8: Production Deployment (Week 7)

QUICK_REFERENCE.md (Quick Guide)
├── TL;DR Summary
├── Quick Start Commands
├── Environment Variables Checklist
├── Docker Compose Reference
├── Service Ports
├── Common Issues & Fixes
├── Development Workflows
├── Feature Availability Matrix
├── Cost Comparison
├── Security Checklist
├── Performance Tips
├── Migration Paths
└── Decision Tree
```

---

## 🔍 Key Findings Summary

### Critical Dependencies (Cannot Eliminate)
1. **PostgreSQL** - Database (50+ models)
2. **File Storage** - S3 or Vercel Blob (can replace with MinIO)
3. **Email** - Resend (can replace with SMTP)
4. **Background Jobs** - Trigger.dev (can replace with BullMQ)

### Optional Dependencies (Can Disable)
- Analytics: Tinybird, PostHog, Jitsu
- Payments: Stripe (test mode OK)
- AI: OpenAI
- OAuth: Google, LinkedIn
- Integrations: Slack, Notion

### Biggest Challenges for Self-Hosting
1. **Background Jobs** (11 Trigger.dev jobs) - 1-2 weeks to migrate to BullMQ
2. **Analytics** (Tinybird) - 2-3 weeks to migrate to ClickHouse
3. **Email System** (Resend) - 3-5 days to migrate to SMTP/Nodemailer

### Recommended Approach
**Hybrid Setup:**
- Self-host: PostgreSQL, MinIO, Redis
- Keep free-tier SaaS: Trigger.dev, Tinybird, Resend
- **Cost:** $20-50/mo
- **Time:** 1-2 weeks setup

---

## 📊 Statistics

**Codebase Analysis:**
- API Routes: 215 total (203 Pages Router, 12 App Router)
- Database Models: 50+
- Background Jobs: 11
- External Services: 20+
- Email Templates: 20+
- Lines of Analysis: 3000+

**Documentation Size:**
- DEPENDENCIES_ANALYSIS.md: ~15,000 words
- QUICK_REFERENCE.md: ~2,000 words
- Total: ~17,000 words

---

## 🎯 Recommended Reading Order

### For Developers (First Time)
1. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Get overview
2. [DEPENDENCIES_ANALYSIS.md - Part 1](DEPENDENCIES_ANALYSIS.md#part-1-complete-external-dependencies-flow) - Understand architecture
3. [QUICK_REFERENCE.md - Quick Start](QUICK_REFERENCE.md#-quick-start-commands) - Set up local environment
4. Start coding!

### For DevOps/Self-Hosting
1. [DEPENDENCIES_ANALYSIS.md - Part 1](DEPENDENCIES_ANALYSIS.md#part-1-complete-external-dependencies-flow) - Understand current setup
2. [DEPENDENCIES_ANALYSIS.md - Part 2](DEPENDENCIES_ANALYSIS.md#part-2-localization-plan---minimal-external-dependencies) - Learn replacement options
3. [DEPENDENCIES_ANALYSIS.md - Minimal Setup](DEPENDENCIES_ANALYSIS.md#minimal-viable-local-setup) - Get Docker Compose files
4. [DEPENDENCIES_ANALYSIS.md - Roadmap](DEPENDENCIES_ANALYSIS.md#implementation-roadmap) - Plan implementation

### For Decision Makers
1. [QUICK_REFERENCE.md - Cost Comparison](QUICK_REFERENCE.md#-cost-comparison) - Understand costs
2. [DEPENDENCIES_ANALYSIS.md - Cost Analysis](DEPENDENCIES_ANALYSIS.md#cost-analysis) - Detailed breakdown
3. [QUICK_REFERENCE.md - Decision Tree](QUICK_REFERENCE.md#-decision-tree) - Choose approach
4. [DEPENDENCIES_ANALYSIS.md - Roadmap](DEPENDENCIES_ANALYSIS.md#implementation-roadmap) - Understand timeline

---

## 🔄 Keeping Documentation Updated

**This documentation was generated on:** December 13, 2024

**Based on:**
- Codebase version: Current main branch
- package.json analysis
- Full repository exploration
- Environment variable analysis

**To update:**
1. Re-run dependency analysis
2. Check for new external services
3. Update migration guides
4. Update cost estimates
5. Refresh roadmap timelines

---

## 📞 Support

**For questions about this documentation:**
- Open an issue with `[docs]` prefix
- Reference specific section/file

**For Papermark features:**
- See main README.md
- Check official docs: https://papermark.io/docs
- GitHub Issues: https://github.com/mfts/papermark/issues

---

## 📝 License

This documentation is part of the Papermark project and follows the same license (AGPLv3).

---

**Happy self-hosting! 🚀**
