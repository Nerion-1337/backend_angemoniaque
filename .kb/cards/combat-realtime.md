---
title: Realtime combat events: broadcast combat outcomes to map spectators
slug: combat-realtime
status: done
updated: 2026-10-19
files:
  - src/lib/events.ts
  - src/routes/combat.ts
  - src/routes/spells.ts
symbols:
  - src/lib/events.ts:combatEvent
  - src/routes/combat.ts:combat
  - src/routes/spells.ts:spells
tests:
  - test/combat-event.test.ts
  - test/integration/combat-realtime.test.ts
---
## Purpose
Makes combat outcomes visible in real time to every other player on the same map: every resolved attack (direct `/combat/attack` or the "Trait de Lumière" attack spell) publishes a `combat` event on the map's Redis pub/sub channel, so spectators' clients (which already re-fetch the visible area on any WS event) refresh immediately instead of waiting for the 8-second polling cycle. The payload is deliberately public-only.

## How it works
- `src/lib/events.ts` exports the pure builder `combatEvent(target, killed, missed=false)` → `{ type: 'combat', target, killed, missed }`. It is the single source of the event shape, shared by both combat entry points.
- `POST /combat/attack` (`src/routes/combat.ts`): after the hit roll and damage application inside the transaction (`applyDamage`), the route broadcasts `combatEvent(t.id, r.killed)` on `a.mp.map_id` — and, new, the miss branch (early return) also broadcasts `combatEvent(t.id, false, true)`, so a dodged attack still refreshes spectators. The move part of a long-range attack (`travel`) emits no separate event; the combat event covers the visual state change.
- `POST /spells/cast` (`src/routes/spells.ts`, spell kind `attack`): previously published a bare `{ type: 'combat' }`; it now publishes the same `combatEvent(t.id, r.killed)` payload, so every channel message has the same shape.
- Fan-out: `realtime/ws.ts` — `broadcast(mapId, evt)` publishes JSON to Redis channel `map:{mapId}`; the app's psubscribed client re-sends each message to every WebSocket joined to that map (`joinMap`), so the event scales across backend instances.
- Privacy: the event carries only the target id, the `killed` flag and the `missed` flag — never exact HP (rule from `map.ts`: other players only ever see a public health state; the client re-fetch `/map/{id}/area` after the event to see the updated state, and for a killed hero the `die()` reposition to map 3).

## Entry points
- `src/lib/events.ts:combatEvent` — import it to emit or build a combat event (do not inline `{type:'combat'}` literals in new routes).
- Emitted from `src/routes/combat.ts` (hit + miss) and `src/routes/spells.ts` (attack spells).
- Consumed by any WS client on `GET /ws?map=N` (front `GameCanvas` treats it like any other map event and re-fetches the area).

## Data flow
- Attack request → transaction (damage applied, death side-effects via `applyDamage`: character → `die()` repositions to the deads map + full HP restore, monster → divine items to the killer + HP reset, summon → deleted) → after commit logic `broadcast(map, {type:'combat', target, killed, missed})` → Redis `map:{id}` → WS clients of the map → clients re-fetch the area (`pub()` health-state mapping).
- No schema change: the event is transient (Redis pub/sub only, nothing persisted).

## Tests
- `test/combat-event.test.ts` (pure, no services): asserts the exact public shape of `combatEvent` (hit vs miss) and the closed key set (no HP or sensitive fields).
- `test/integration/combat-realtime.test.ts` (skipped without `DATABASE_URL` + `REDIS_URL`; runs in CI and `stack exec backend`): registers an account, creates two same-race characters, places the target on a free cell adjacent to the attacker, subscribes a raw Redis client to `map:{mapId}`, fires `/combat/attack`, and asserts a `combat` event for that target arrives within 10 s with `killed`/`missed` consistent with the HTTP response.

## Gotchas
- Event payload stays public-only by design — never add exact HP, gold or other private stats to it (mirrors the `pub()` rule of `map.ts`).
- Keep using `combatEvent()` from `lib/events.ts` when adding new combat-emitting routes; a second shape on the same channel breaks client-side handling.
- The miss path MUST broadcast too: spectators rely on it for refresh; removing it silently reintroduces the 8-second lag.
- Filtering in tests is by `target` id because other suites share the same maps and may emit other `map:*` events concurrently.
- Death of a character is not a deletion: `die()` moves the position to map 3 (deads) and restores HP — a spectator re-fetch will simply no longer see the character on the original map.
