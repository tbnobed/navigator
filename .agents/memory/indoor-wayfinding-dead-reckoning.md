---
name: Indoor wayfinding without beacons
description: How to prototype indoor QR-to-destination navigation on a phone with no BLE beacons/UWB/ARKit world tracking available.
---

Real indoor positioning needs hardware (BLE beacons, UWB, or a pre-scanned
ARKit/ARCore world map) that isn't available in this environment. A workable
prototype substitute: model the building as a graph (nodes/edges in meters,
Dijkstra for routing), then track the user's progress along the routed
polyline using phone dead-reckoning — step count (expo-sensors Pedometer) ×
stride length converted to distance travelled along the path, plus compass
heading (expo-location watchHeadingAsync) for a self-calibrating AR arrow
(offset computed once from the first heading sample vs. the entrance's known
facing direction, not from true north).

**Why:** Projecting distance-walked onto the known route polyline (rather than
freely integrating heading+distance into an x/y position) bounds drift to
"how far along the path", which is far more robust than raw dead reckoning.

**How to apply:** Reuse this pattern (graph + Dijkstra + per-leg polyline
projection + step-based distanceAlong + one-shot heading calibration) for any
similar "no hardware available" indoor/outdoor guided-walk feature. Always
add a manual correction control (e.g. "snap to next waypoint") since dead
reckoning drifts over time, and require explicit user confirmation for floor
changes (elevator/stairs) since phones can't sense floor transitions.
