---
name: Wayfinder admin sites architecture
description: How admin-created sites are stored/served and the constraints to respect when extending the wayfinder-web admin portal.
---

# Wayfinder admin sites

- Admin-created sites are stored **pixel-based** (node px/py + `metersPerPixel`) in JSON files under the server data dir, and converted to the runtime meter-based `Building` shape **on the client**. The built-in Broadcast Studios demo stays hardcoded and is merged with published API sites in the visitor app.
  - **Why:** keeps the server dumb (no geometry), lets the editor work in image coordinates, and preserves the demo site without a migration.
  - **How to apply:** any new site field should be added to the stored (pixel) shape + the client converter, not to `Building` directly.
- Deployment is a single Node container (express serves built SPA + API; `SERVE_STATIC=1`), data on a mounted volume — no database. Admin auth = single `ADMIN_PASSWORD` env (dev fallback "admin"), random in-memory session tokens in an HttpOnly cookie (server restart signs admins out; that's accepted).
- The vite dev server proxies `<BASE_PATH>api/*` to a local express process (`WAYFINDER_API_PORT`, default 8790) started by `concurrently` in the dev script; API calls in app code must be `${import.meta.env.BASE_URL}api/...`.
- Docker deploy constraints: base image must be Debian/glibc (`node:*-slim`, never alpine — the workspace excludes musl native binaries for rollup/esbuild/tailwind), and pnpm must be pinned to the workspace's major (pnpm@10; "latest" turns ignored-build-script warnings into fatal errors).
- Publishing is gated by client+server validation (`siteIsNavigable`): every entrance must reach every labeled destination through drawn edges — routing breaks silently otherwise.
