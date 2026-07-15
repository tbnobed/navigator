---
name: AR ground-plane projection pitfalls
description: Lessons from debugging the wayfinder AR floor-path overlay (invisible lines, pitch sign, demo-site id collisions).
---

# AR ground-plane projection pitfalls

1. **CSS variables are invalid in SVG presentation attributes.** `stroke="hsl(var(--primary))"` is silently dropped → stroke falls back to `none` → the path renders completely invisibly. Set color via `style={{ stroke }}` / `style={{ fill }}` instead.
   **How to apply:** any SVG overlay that takes a theme color.

2. **Camera pitch rotation signs are easy to invert.** With the camera pitched DOWN by p, forward axis = (cos p, −sin p), up axis = (sin p, cos p) in (forward, up) world coords. For a floor point (f, −h): `depth = f·cos p + h·sin p`, `vertical = f·sin p − h·cos p`. The inverted version compiles, looks plausible, and simply pushes everything off the bottom of the screen at natural phone tilt (beta ≤ 60) — projecting *zero* points. **Verify projection math numerically in node with realistic beta values (90/75/60/45) before shipping**; a 20-line simulation found in minutes what several on-device sessions didn't.

3. **Built-in demo building vs stored sites: id collisions.** The visitor building list merges static demo buildings with admin-created sites; the production site shares the demo's id (`studios`). Stored sites must come FIRST and colliding demo ids must be filtered, or visitors get routed on the demo's marked-up floorplan.
   **How to apply:** whenever composing the buildings list or adding new demo content, never let a static building shadow a stored site id.
