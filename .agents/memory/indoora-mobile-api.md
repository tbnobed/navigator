---
name: Indoora mobile API base
description: How the Expo app reaches the sites API, and cross-origin requirements.
---

The sites/admin API is served by the **wayfinder-web** server (single-container deploy), NOT the api-server artifact.

**Rule:** The Expo app resolves its API base as: `EXPO_PUBLIC_API_URL` (production self-hosted server, e.g. https://nav.obtv.io) → else `https://$EXPO_PUBLIC_DOMAIN/go` (Replit dev, web artifact base path `/go`).

**Why:** api-server only has /api/healthz; pointing the mobile app there returns nothing. Mobile clients are cross-origin, so the web server sends `Access-Control-Allow-Origin: *` (safe: wildcard never allows the cookie-based admin auth cross-origin).

**How to apply:** Production mobile builds must set EXPO_PUBLIC_API_URL at build time. If the web artifact's base path changes, update `artifacts/wayfinder/lib/api.ts`.
