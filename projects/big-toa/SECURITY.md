# Security Policy

## Reporting a Vulnerability

> **Please do NOT report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in BigToa, please report it privately to protect our users.

### How to Report

**Email:** <admin@bigtoa.com>

#### What to Include

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if you have one)
- Your contact information

### What to Expect

- **Acknowledgment:** We will acknowledge receipt of your vulnerability report within 48 hours
- **Assessment:** We will assess the issue and provide an estimated timeline for a fix within 5 business days
- **Updates:** We will keep you informed of our progress
- **Resolution:** Once fixed, we will publicly disclose the vulnerability (with your credit, if desired)
- **Reward:** We may offer a bug bounty for significant findings

---

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Security Features

### Authentication

- ✅ JWT-based authentication with HttpOnly cookies
- ✅ Multi-Factor Authentication (TOTP)
- ✅ WebAuthn/Passkey support
- ✅ Password breach detection (Have I Been Pwned API)
- ✅ Account lockout (5 failed attempts → 30-minute lockout)
- ✅ Progressive login delays (0s → 2s → 5s → 10s)
- ✅ Password policy enforcement (configurable complexity)
- ✅ Password history tracking (prevent reuse)

### Data Protection

- ✅ HTTPS/TLS 1.3 encryption (all traffic)
- ✅ HSTS enabled (1-year max-age, preload ready)
- ✅ Database encryption at rest (AWS RDS)
- ✅ Client-side vault encryption (AES-256-GCM with PBKDF2-SHA-256 600,000 rounds, OWASP 2023 baseline). Vault refuses to encrypt or decrypt until the user has set a per-account passphrase; no compiled-in default and no env-var fallback (verified by Jest unit tests in `big-toa-frontend/src/utils/__tests__/encryption.test.ts`). Ciphertext carries a self-describing 4-byte header (`BTV` + version) so future KDF upgrades drop in without ambiguity; legacy v1 ciphertext (PBKDF2 100k, no header) still decrypts for back-compat.
- ✅ Scheduled "future messages" stored as plaintext on the server so the delivery job can send them (this is intentional; the compose UI discloses it and directs users to the Vault for secrets). The DB column is named `body_text` to match the truth.
- ✅ PBKDF2-SHA-256 password hashing
- ✅ Automated PII scrubbing from logs

### Public-Token Endpoints

- ✅ Unauthenticated public-token endpoints (`/api/final-message/<slug>/`, `/api/heir-response/<token>/`) are rate-limited via DRF scope `public_token_view` (default 30/hour per IP, env-overridable).
- ✅ Every hit (including 404s) writes a `PublicTokenAccessLog` row recording kind, sha256-prefix of the token, HTTP method/status, IP and truncated User-Agent. The raw token is never stored in the audit table.
- ✅ Heir response tokens carry a 90-day hard expiry and are rotated on every re-solicitation, so a leaked link from a prior batch stops working immediately.
- ✅ Heir lost-link recovery (`POST /api/heir-response-recovery/`, T2.4): always returns the same neutral 200 regardless of match (no enumeration), tighter scope `heir_link_recovery` (default 5/hour per IP). When a match is found, the **owner** is emailed a notification with the heir's address masked (`ja**@example.com`); the heir never receives a link from this endpoint and the response token is not rotated. Audit-logged with the `heir_link_recovery` kind, sha256-prefix of the lower-cased email.

### Tier-0 UPL Safety

- ✅ Advance Directive surface is upload-only, gated behind a blocking modal acknowledgment, prominent disclaimer, and state-aware notice (`feature_key=advance_directive_v1`). Document.legal_role is forced to `healthcare_directive` on upload so executors can find the signed copy later.
- ✅ Personal Property Memorandum export at `/api/personal-property-memorandum/` is state-blocked: returns 400 with `code: state_required` if `UserProfile.state` is unset. Includes UPC § 2-513 incorporation-by-reference clause naming the user's state for `PPM_RECOGNIZING_STATES`; substitutes "memorandum of intent" framing for non-recognizing states. Footer always carries "consult an attorney licensed in [user's state]" + "BigToa is an estate-planning organizer, not a law firm."
- ✅ `Document.legal_role` is a user-applied tag (will / trust / poa / healthcare_directive / hipaa / beneficiary_designation / tod / other_legal). Default is empty string ("Not a legal instrument"). BigToa never auto-classifies and never displays a document as system-affirmed.
- ✅ Attorney Estate Summary reframed as a "working document, not a legal instrument" with prominent + inline disclaimers.
- ✅ Heir solicitation emails (HTML + plaintext templates) and the public response page reframed as a preferences survey, not a legal bequest.
- ✅ Final Wishes form carries inline disclaimer + state-aware mention of CA Health & Safety Code § 7100 as a representative funeral-directive statute.
- ✅ Estate-adjacent marketing copy and the 9 estate-related blog posts in the production database carry a "BigToa is not a law firm. Nothing here is legal advice. Consult an attorney licensed in your state." block, applied via two idempotent Django scripts (`scripts/add_estate_blog_disclaimers.py`, `scripts/cleanup_duplicate_blog_disclaimers.py`).

### Emergency Access (Trusted-Contact Flow)

- ✅ 14-day default waiting period (was 72 hours pre-T1.4, 2026-04-25).
- ✅ Multi-channel notification when a request is filed: in-app notification + primary email + optional `UserProfile.recovery_email` + SMS (if a phone is on profile).
- ✅ Daily reminder emails throughout the wait via the `send_emergency_request_reminders` Celery task. One reminder per pending request per ~24h.
- ✅ Owner-controlled pause: one click adds 30 days to the auto-approval timer; idempotent / compounding; capped at 1 year past the original request.
- ✅ **Two-trustee quorum** (opt-in via UserProfile `emergency_access_requires_quorum` + `emergency_access_cosigner`): when on, an emergency-access request against the user auto-approves only after BOTH the wait window has elapsed AND the named cosigner has approved. `CanViewVaultObject` makes auto-approval grant vault read access **only** for properly cosigned requests; without quorum, `STATE_TIMED_OUT` is informational and does not grant access. Owner-explicit `approve` always works without quorum (it is the owner's vault).

### Fire-Drill Preview (T2.3)

- ✅ Owner-only sandboxed simulation at `GET /api/fire-drill/preview/` aggregates everything BigToa would do the day the user dies (recipients, items, future messages, vault count, gaps, timeline) into a single read-only payload. The endpoint sends nothing, mutates nothing, never decrypts vault entries, and never echoes raw email/phone in the response (always masked). Side-effect contract enforced by tests covering row-count snapshots across Items / EstateContacts / HeirItemInterest / FutureMessage / FarewellVideo / DigitalAsset, the `mail.outbox` size, and `response_token` invariance.
- ✅ Front-end at `/estate/fire-drill` leads with a "this is a sandboxed simulation, nothing is being sent" banner and ends with a "consult an attorney licensed in your state" disclaimer. UPL-safe day-offset framing: numbers describe BigToa's own delivery flow, not legal-effective dates.

### API Security

- ✅ Rate limiting (per-endpoint throttling)
- ✅ CORS whitelist (no allow-all origins)
- ✅ CSRF protection (token-based)
- ✅ Input validation (Django REST Framework serializers)
- ✅ SQL injection prevention (Django ORM only)

### Security Headers

- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Permissions-Policy (restrictive)
- ✅ Content-Security-Policy (production)
- ✅ Cross-Origin-Opener-Policy: same-origin
- ✅ Cross-Origin-Resource-Policy: same-site

### Monitoring & Logging

- ✅ Audit logging (password resets, MFA attempts, vault access)
- ✅ PII sanitization (addresses, passwords, tokens auto-redacted)
- ✅ IP address tracking (security events only)
- ✅ Failed login tracking

---

## Security Scanning

We use automated security scanning to detect vulnerabilities:

### Daily Scans

- **Secrets Scanning:** TruffleHog + Gitleaks (detect exposed credentials)
- **Dependency Scanning:** npm audit (frontend), Safety + pip-audit (backend)
- **Static Analysis:** Bandit (Python SAST), ESLint security rules (JavaScript)

### Weekly Scans

- **CodeQL Analysis:** GitHub Advanced Security (JavaScript + Python)
- **OWASP Dependency Check:** CVE database cross-reference
- **Dependabot:** Automated dependency updates

### On Every PR

- **npm audit:** Blocks PRs with critical/high vulnerabilities
- **Secrets detection:** Prevents committing credentials
- **Code review:** Manual security review required

---

## Security Best Practices (For Developers)

### 1. Never Commit Secrets

**❌ Don't** hardcode secrets in source:

```python
API_KEY = "sk-live-1234567890"  # NEVER hardcode secrets
```

**✅ Do** read them from environment variables:

```python
API_KEY = os.environ.get("API_KEY")  # Use environment variables
```

### 2. Always Sanitize Logs

**❌ Don't** log raw PII:

```python
logger.info(f"User data: {user.address}")  # Exposes PII
```

**✅ Do** use the sanitized logger helper:

```python
from inventory.utils.logging_sanitizer import get_sanitized_logger
logger = get_sanitized_logger(__name__)
logger.info("User data: %s", user_data)  # Auto-sanitized
```

### 3. Validate All Inputs

**❌ Don't** accept request payloads without validation:

```python
email = request.data.get("email")  # No validation
User.objects.create(email=email)
```

**✅ Do** route every payload through a DRF serializer:

```python
serializer = UserSerializer(data=request.data)
if serializer.is_valid():
    serializer.save()
```

### 4. Use Parameterized Queries

**❌ Don't** build SQL by string-formatting user input:

```python
query = f"SELECT * FROM users WHERE email = '{email}'"  # SQL injection!
```

**✅ Do** go through the Django ORM, which parameterizes for you:

```python
User.objects.filter(email=email)  # Django ORM (safe)
```

### 5. Keep Dependencies Updated

```bash
# Frontend
npm audit
npm audit fix

# Backend
safety check
pip-audit
```

---

## Compliance

### Standards We Follow

- **OWASP Top 10** (2021) - Web application security
- **CWE Top 25** - Most dangerous software weaknesses
- **NIST Cybersecurity Framework** - Risk management
- **PCI DSS** (via Stripe) - Payment card security

### Regulations We Comply With

- **CCPA** (California Consumer Privacy Act)
- **VCDPA** (Virginia Consumer Data Protection Act)
- **State Data Breach Notification Laws** (All 50 US states)

### Target Certifications

- **SOC 2 Type II** (in progress)

---

## Incident Response

In the event of a security incident, we follow this process:

1. **Detection** (0-1 hour)
   - Automated alerts trigger
   - Security team notified

2. **Assessment** (1-4 hours)
   - Determine scope and impact
   - Identify affected users/data
   - Classify severity (Critical, High, Medium, Low)

3. **Containment** (4-12 hours)
   - Isolate affected systems
   - Prevent further damage
   - Preserve evidence

4. **Eradication** (12-48 hours)
   - Remove threat
   - Patch vulnerabilities
   - Verify fix

5. **Recovery** (48-72 hours)
   - Restore services
   - Monitor for re-infection
   - Verify security

6. **Notification** (72 hours max)
   - Notify affected users (email)
   - File required breach reports
   - Public disclosure (if appropriate)

7. **Post-Mortem** (within 7 days)
   - Root cause analysis
   - Update security controls
   - Document lessons learned

---

## Security Contacts

| Role | Contact |
| --- | --- |
| **Security Team** | <security@bigtoa.com> |
| **Bug Bounty** | <bugbounty@bigtoa.com> |
| **Privacy Team** | <privacy@bigtoa.com> |
| **Legal** | <legal@bigtoa.com> |

---

## Acknowledgments

We thank the following security researchers for responsibly disclosing vulnerabilities:

- (List will be updated as issues are reported and fixed)

---

## Security Updates

Subscribe to security updates:

- **GitHub Watch:** Watch this repository for security advisories
- **Email:** Subscribe at [https://bigtoa.com/security-updates](https://bigtoa.com/security-updates)
- **RSS:** [https://github.com/YOUR-ORG/Inventory/security/advisories.atom](https://github.com/YOUR-ORG/Inventory/security/advisories.atom)

---

**Last Updated:** April 26, 2026 (Tier-2 reliability pass: heir lost-link recovery with owner-notification + neutral-response no-enumeration design, fire-drill preview endpoint with enforced read-only contract, reachable `/farewell-video/new` + `/final-message/new` creation routes, dead `legacy_access` Django app removed with legacy-table migration guards. Tier-1 security pass + Tier-0 UPL safety from 2026-04-25 remains in force.)
**Next Review:** July 26, 2026
