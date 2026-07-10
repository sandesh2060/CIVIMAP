# CiviMap Server — Auth Module
 
## Setup
```
cd server
npm install
cp .env.example .env   # fill in real secrets — generate with: openssl rand -hex 64
npm run dev
```
 
## Security features implemented
- bcrypt (cost 12) password hashing, never logged or serialized
- Short-lived JWT access tokens (HS256, pinned algorithm, iss/aud/exp validated)
- Refresh tokens: opaque random, stored only as SHA-256 hash, httpOnly+secure+SameSite=strict cookie,
  single-use rotation with theft/reuse detection (revokes entire token family on reuse)
- tokenVersion bump on password reset / logout-everywhere instantly invalidates old tokens
- Email OTP verification (hashed, time-limited, attempt-limited)
- Password reset via random token (hashed, time-limited), generic responses to prevent
  account enumeration
- Account lockout after 5 failed logins (15 min lockout)
- express-rate-limit on all auth endpoints (tighter limits on OTP/reset)
- Helmet (CSP, HSTS, frame-ancestors none), strict single-origin CORS with credentials
- express-mongo-sanitize (NoSQL injection) + hpp (parameter pollution)
- Centralized error handler — no stack traces / DB errors ever reach the client
- Zod schema validation on every auth input, enforced strong password policy
