# BigToa

> **AI-powered home inventory for insurance, estate planning, and collections.**

Photograph your belongings. AI extracts details - make, model, serial number, estimated value. Everything organized for insurance claims, estate planning, collection tracking, or resale.

**Production:** [bigtoa.com](https://www.bigtoa.com) | **API:** [inventory.bigtoa.com/api/](https://inventory.bigtoa.com/api/) | **Docs:** [inventory.bigtoa.com/swagger/](https://inventory.bigtoa.com/swagger/)

---

## Quick Start

```bash
# Backend (terminal 1)
cd big_toa_backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver                    # localhost:8000

# Frontend (terminal 2)
cd big-toa-frontend
npm install
npm run dev                                   # localhost:3000
```

Or press `Ctrl+Shift+B` in VS Code and select **"Start BigToa (frontend + backend)"**.

**Local URLs:** Frontend `localhost:3000` | API `localhost:8000/api/` | Admin `localhost:8000/admin/` | Swagger `localhost:8000/swagger/`

---

## Tech Stack

```text
Frontend       Next.js 16, TypeScript 5.8, Chakra UI v3, React 19
Backend        Django 5.2, Django REST Framework 3.15, Python 3.11+
Database       PostgreSQL 18, Redis (cache + Celery broker)
Auth           JWT (HttpOnly cookies), Google OAuth, Magic Links, WebAuthn/Passkeys, TOTP MFA
AI             Anthropic Claude (Sonnet 4.5 for demos, Haiku for production)
Payments       Stripe (subscriptions, trials, lifetime offers, webhooks)
Email          Mailgun (via django-anymail)
Storage        AWS S3 + CloudFront CDN
Task Queue     Celery 5.5 + Beat scheduler
Hosting        Render (backend + worker + Redis) + Vercel (frontend)
Testing        Jest, Playwright (E2E + accessibility), Django TestCase
CI/CD          GitHub Actions (lint, tests, E2E, a11y, Lighthouse, CodeQL, security scan)
```

---

## Architecture

```text
      Vercel (CDN)                          Render
    +-------------+                   +------------------+
    |  Next.js 16 |    /api proxy     |  Django 5.2      |
    |  SSR + SPA  | ----------------> |  DRF + Gunicorn  |
    |  Chakra UI  |   JWT cookies     |                  |
    +-------------+                   +--------+---------+
                                               |
                                    +----------+----------+
                                    |                     |
                              +-----+------+       +------+------+
                              | PostgreSQL |       | Redis       |
                              | (Render)   |       | Cache + MQ  |
                              +------------+       +------+------+
                                                          |
                                                   +------+------+
                                                   | Celery      |
                                                   | Worker+Beat |
                                                   +-------------+
```

### Design decisions

- JWT in HttpOnly cookies (not localStorage) - custom `CookieJWTAuthentication`
- Zero-knowledge vault - AES-256-GCM client-side, PBKDF2-SHA-256 600,000 rounds (OWASP 2023 baseline). Vault refuses to encrypt or decrypt until the user has set their own passphrase (no fallback / default secret on the server or in the source bundle). Self-describing v2 ciphertext format with magic prefix `BTV` + 1-byte version supports drop-in KDF upgrades.
- Emergency-access requests use a 14-day multi-channel notification window (email primary + recovery email + SMS + in-app) with daily reminders and an owner-controlled pause that adds 30 days per click (1-year cap). Auto-approval is informational by default and only grants vault access when the user has opted into two-trustee approval (cosigner) and that cosigner has approved. Owner-explicit approve always works without quorum. Replaces the prior 72-hour silent timeout.
- Public-token endpoints (`final-message/<slug>/`, `heir-response/<token>/`) are throttled (`public_token_view`, default 30/hour per IP), have a 90-day hard expiry on heir tokens, and write a forensic `PublicTokenAccessLog` row on every hit (sha256-prefix only; the raw token is never stored).
- Dual analytics - GA4 + server-side Django DB (ad-blocker resistant)
- Passwordless-first registration - email capture with deferred password

---

## Features

### AI Inventory

- Upload 1-5 photos, Claude AI extracts structured data (name, manufacturer, model, serial number, UPC/barcode, condition, replacement value, current value)
- Anonymous demo on all marketing pages (no account required, rate-limited 3/IP/day)
- Demo items auto-claimed into user's inventory on signup
- Confidence levels for each extracted field

### Insurance Documentation

- Photo-based proof of ownership for insurance claims
- Blanket policy and scheduled item policy tracking
- PDF export for agents and adjusters
- Partner sharing with view-only access for insurance agents
- Insurance audit trail
- Appraisal tracking with automated email reminders (configurable intervals)
- Insurance sublimit documentation

### Estate Organizing

- Digital vault with zero-knowledge AES-256-GCM encryption (mandatory passphrase setup; no server fallback). SOC-2 compliant audit logs
- Heir assignment - designate who gets what
- Executor and attorney access with granular permissions
- Document storage with versioning (wills, trusts, appraisals)
- Estate contact management
- Emergency access requests: trusted-contact flow with a 14-day default waiting period, multi-channel owner notification (primary email + optional recovery email + SMS + in-app), daily reminder emails during the wait, and a one-click owner-controlled pause (+30 days per press, 1-year cap). Optional two-trustee approval gates the auto-approval on a cosigner the owner has named (Profile > Emergency Access). The requester is walked through a 3-step explainer modal before submitting so they understand it is not immediate access; cosigners see a dedicated approval surface on their dashboard with explicit "verify in person before approving" guidance.
- Scheduled "future messages" delivered by email (stored as plaintext on the server so the email job can deliver them - the compose UI discloses this and routes secrets to the Vault). Optional farewell-video attachment.
- Final wishes documentation
- Attorney summary generation
- State-aware legal disclaimer infrastructure (`UserProfile.state` + per-feature versioned acknowledgment) underpinning the in-product "this is not legal advice" surfaces. Drives jurisdiction-specific behavior on advance directive, Personal Property Memorandum export, and community-property warnings.
- UPL-safe surfaces (Tier-0 audit remediation):
  - **Advance Directive** is upload-only with a blocking modal-acknowledge gate, prominent disclaimer, state-aware notice, and explicit "I have signed (and witnessed/notarized) this version" checkbox before save.
  - **Personal Property Memorandum** export at `/estate/personal-property-memorandum/` -- state-blocked (400 if `UserProfile.state` is unset), state-aware incorporation-by-reference clause naming the user's state, browser-native print-to-PDF, mandatory ack gate. Recognizing-state vs. non-recognizing-state framings under PPM_RECOGNIZING_STATES.
  - **Attorney Estate Summary** reframed as "For your attorney's review" with a prominent "working document, not a legal instrument" banner.
  - **Heir solicitation** emails + public response page reframed as a preferences survey, not a legal bequest.
  - **Final Wishes** form carries an inline disclaimer plus a state-aware mention of California Health & Safety Code § 7100 et seq. as a representative example.
  - **`Document.legal_role`** is a user-applied tag (default "Not a legal instrument"). BigToa never auto-classifies and never affirms a document's legal validity.

### Collections & Collectibles

- Category-specific catalogs (sports cards, coins, comics, jewelry, firearms, art, stamps)
- Market value tracking with eBay comparable pricing
- Insurance sublimit awareness
- Bulk import and QR label support

### Marketplace Integration

- **eBay:** OAuth2 integration, category matching, AI-assisted pricing, real-time sync, listing management
- **Facebook Marketplace:** Direct listing with OAuth2 authentication
- **Yard Sales:** Create events (up to 20), schedule dates, set locations, QR codes for public sharing, per-item display overrides

### Collaboration & Sharing

- Role-based sharing (view, edit, manage) for items, collections, and vault
- Predefined collaborator role templates
- Partner access for family, appraisers, estate planners, attorneys
- Activity logs and audit trail for all shared content
- Public share links with UUID-based access

### Security

- **Authentication:** JWT, Google OAuth, Facebook OAuth, Magic Links, WebAuthn/Passkeys, TOTP MFA
- **MFA:** Mandatory for admins, optional for users. TOTP (Google Authenticator/Authy) with backup codes
- **Passkeys:** FIDO2/WebAuthn for passwordless biometric login
- **Encryption:** TLS in transit, AES-256 at rest, AES-GCM client-side for vault
- **Password security:** Breach detection (Have I Been Pwned), password history, configurable policy
- **Rate limiting:** Per-endpoint throttling (login 10/min, register 5/min, exports 3/min)
- **Account lockout:** 5 failed attempts = 30-minute lockout
- **Spam/fraud blocking:** Country-based blocking (8 high-fraud countries), IP range blocking, 100+ spam referrer domains
- **Audit:** SOC-1/SOC-2 compliant immutable logs, vault access tracking, login activity
- **GDPR/CCPA:** Full data export, account deletion, privacy controls
- **Security headers:** CSP, HSTS, X-Frame-Options, X-Content-Type-Options

### Notifications & Reminders

- In-app notifications for shared content, access requests, heir responses
- Appraisal reminder emails (configurable intervals via Celery Beat)
- Warranty expiration alerts
- Insurance policy renewal reminders
- Trial ending notifications (Stripe webhook-driven)

### Affiliate Program

- Tiered affiliate system with unique referral codes
- Click tracking and conversion attribution
- Commission calculation and payout management
- Discount code generation with approval workflow
- Affiliate dashboard with analytics

### Tools Inventory (Separate Subscription)

- Tool taxonomy (brands, categories, vendors)
- Storage location hierarchy
- AI-powered tool analysis and receipt OCR
- Loaner toolbox system with drawer verification
- Price lookup across vendors
- Instructor/student account support

---

## User Registration Flow

```text
Marketing page -> Try AI demo (upload photo) -> See results -> Enter email
-> Passwordless account created -> 7-day Premium trial starts (no payment method)
-> User lands on Dashboard immediately (JWT cookies set)
-> Set password later via email link (optional)
-> TrialBanner counts down in dashboard
-> Day 7: trial pauses -> downgrade to Free -> email notification
-> Add payment method anytime to resume Premium
```

**Four sign-in methods:** Email + password | Email-only (passwordless) | Google OAuth | Magic link (15 min, one-time)

---

## Subscription Plans

| Plan | Items | Photos | Key Features |
| ---- | ----- | ------ | ------------ |
| Free | 25 | 2/item | Cloud backup, mobile app |
| Plus | 500 | Unlimited | Insurance tracking, reports, export |
| Premium | Unlimited | Unlimited | Estate tools, vault, 3 heirs, priority support |
| Ultimate | Unlimited | Unlimited | Unlimited heirs, farewell video, account manager |

Lifetime offers available (Plus $119, Premium $239, Ultimate $479). New users get a 7-day Premium trial with no payment method required.

---

## Analytics (30 Event Types)

Server-side tracking alongside GA4/Meta Pixel. Admin dashboard at `/admin-dashboard/analytics` with 7 tabs: Conversion Funnel, Full Funnel (12-step visual), Devices, Referrer Performance, Marketing Pages, Plan Popularity, Page Views.

**Demo funnel:** demo_viewed, demo_upload_started, demo_upload_completed, demo_results_shown, demo_signup_clicked

**Registration:** email_gate_submit, account_created, trial_started

**Billing:** payment_method_added, subscription_started, subscription_renewed, cancellation_requested

---

## Automated Tasks (Celery Beat)

| Task | Schedule | Purpose |
| ---- | -------- | ------- |
| Emergency access promotion | Every 15 min | Promote pending emergency requests |
| Future message delivery | Every 15 min | Deliver scheduled messages |
| Claim link cleanup | Daily 3:00 AM | Remove expired claim links |
| Demo analysis cleanup | Daily 2:00 AM | Remove expired demo data (24h) |
| Appraisal/warranty reminders | Daily 2:00 PM | Email + in-app alerts |
| Database backup | Daily 2:00 AM | Automated backup (SOC-1) |
| Backup verification | Weekly Sunday 3:00 AM | Verify latest backup integrity |

---

## Testing

```bash
# Backend (49+ tests: endpoints, flows, security)
cd big_toa_backend
python manage.py test inventory.tests

# Frontend unit tests (18+ tests: components, flows)
cd big-toa-frontend
npm test

# E2E tests
npx playwright test

# Accessibility tests (axe-core)
npx playwright test --project=accessibility
```

CI/CD runs on every PR: ESLint, Jest, Playwright E2E, accessibility, Lighthouse budgets, CodeQL, security scanning.

---

## Environment

Requires Python 3.11+, Node.js 20+, PostgreSQL 18. Full environment variable reference is maintained in the project's internal Developer Guide.

---

## License

Copyright 2025-2026 BigToa LLC. All rights reserved.

*Contact: <admin@bigtoa.com> | Salt Lake City, UT*
