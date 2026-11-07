# Step 5: minimal interior reconciliation

Source remains GitHub Main at d78ae2b, with fixes 1–4 retained. The old checkout is read-only reference, not merged.

`room-adapter.ts` restores eight purposes already present in the old interior system and current street destinations: Learning hall, own home, gym, boutique, prayer space, trading floor, bounty studio and conference hall. It uses lazy, cached geometry; only the active room is visible. It reuses existing HTML actions instead of importing old gameplay. No extra floor, lounge building, district, wardrobe rewards, career, events, TV/news, seating or sleep systems are imported.

The simplified layouts are adapted, not visual copies or claims of live parity. Home includes bed, desk/monitor/keyboard, chair, bookcase and sofa. Campus/conference include lectern, chair rows and bookcase. Gym has a weight bench and bar. Boutique has a garment rack and mirror. Trading/studio have work desks and chairs. Prayer room has a lectern and rugs. Existing materials, wall/window/board details, base trim and a plant use no purchased or external assets and no extra real-time lights.

Colliding furniture is marked essential and stays out of the decorative collection. Noncolliding wall details/plants/rugs are collected for later graphics tiers. Floors and gold interaction markers are never decoration. Mesh budgets are tested below 120 per lazy room; draw calls and visual quality still need preview/device measurement.

Street buildings and colliders are unchanged. Door actions transition into an isolated room at x=400, and room exit returns the copied original street position. Indoor bounds use room colliders with city clamping explicitly disabled only inside; floor taps are checked in room-local coordinates and against walls/furniture. Current SceneGate holds camera and character during sheets. Hidden cached rooms cannot block taps or camera rays. Network payload format and save schema are unchanged: while indoors, persistence, map and presence retain the original street position, with movement false in presence.

Tests cover all eight spawn/action/exit clearances, central exit aisles, composite furniture, mesh budgets, decor exclusions, room round trips, street-coordinate persistence/presence routing, room collision, course action/CV persistence, and existing scene/input/tap tests. These do not replace browser or real-phone verification.

Not restored: the members lounge absent from this GitHub city's destinations, upper floor, rank-gated furniture, detailed kitchen/pool, seating/sleep/TV/events. Church, cafés, carbon/gadgets and other houses keep their existing HTML panels. No wallet/auth/protocol/contracts changes.
