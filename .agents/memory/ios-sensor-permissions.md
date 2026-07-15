---
name: iOS Safari motion/orientation permissions
description: Quirks of DeviceMotion/DeviceOrientation requestPermission on iOS Safari for dead-reckoning web apps
---

Rule: on iOS Safari, DeviceMotionEvent and DeviceOrientationEvent share ONE "Motion & Orientation Access" permission. Requesting both in one tap is fragile: the first prompt consumes the user gesture, so the second `requestPermission()` can throw or report "denied" even though access is actually granted.

**Why:** This silently killed the compass in the wayfinder web app — heading stayed null, AR direction froze, and dead-reckoning fell back to a constant entrance bearing with no visible error.

**How to apply:**
- Request permissions sequentially, never `Promise.all`.
- Attach the event listeners regardless of the reported result — if truly denied, no events fire (harmless); if it was a consumed-gesture artifact, events flow.
- Treat "events actually received" (not the permission result) as the source of truth for sensor availability, and surface a visible warning in the UI when no events arrive.
- iPhone-held-in-hand walking produces soft accelerometer peaks; step thresholds ~1.0 m/s² residual work better than pocket-tuned ~1.6.
