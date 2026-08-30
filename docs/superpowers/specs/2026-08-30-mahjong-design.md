# Mahjong (mahjong.harrys.monster) — Design

Hong Kong mahjong for 2–4 friends in a browser. Room-code lobbies, no accounts,
full faan scoring, server-authoritative rules. Runs as one Bun process on the
waypoint VPS behind Caddy, like analytics.

## Decisions (from brainstorming, 2026-08-30)

- Variant: Hong Kong / Cantonese, 144 tiles including 8 flowers.
- Scoring: full faan counting with enforced minimum (default 3, host-configurable
  0–5). Points = 2^faan, capped at 13 faan (limit hand). Discarder pays the full
  amount alone; on self-draw all others pay.
- Access: no accounts. Create room → 4-letter code → share
  `mahjong.harrys.monster/r/ABCD`. Join with a display name.
- Room config (host sets at creation): seats 2–4, game length (single hand /
  one wind / full game), min faan, turn timer on/off.
- Dropouts: humans only, no bots. A dropped seat pauses the game; the player
  reconnects via the same link and a localStorage token to resume.
- Persistence: in-memory only. A server restart kills active games. Accepted.
- Platform: phone and desktop as equals; design mobile-first.
- Extras in v1: sound effects, visual-only turn timer. No chat.
- Deploy: waypoint Hetzner VPS, docker compose service on the `edge` network,
  Caddy vhost. Analytics snippet per SNIPPET.md checklist.

## Architecture

One repo, one process, one container.

```
engine/   pure TS rules module: no I/O, no dependencies
server/   Bun.serve: WebSocket game protocol + serves web/dist
web/      Vite + React client
```

The server holds the only true game state. Clients send intents; the engine
validates them; the server broadcasts per-seat filtered snapshots. A client
never receives an opponent's concealed tiles, so client-side cheating reads
nothing useful.

## Rooms

- `Map<code, Room>` in the server process. Codes are 4 uppercase letters.
- Lifecycle: create → lobby (players claim seats, host starts when full) →
  playing → hand end (score screen, next hand or match end) → match end
  (rematch resets scores, same room).
- Join issues a random player token stored in localStorage. Token → seat.
  Reconnect with the token resumes the seat and receives a fresh snapshot.
- Any disconnected seat freezes the game with a "waiting for X" overlay.
- Rooms idle for 6 hours are deleted.

## Engine

Pure functions `(state, seatAction) → newState | error`. All randomness (wall
shuffle) injected so tests are deterministic.

- Wall: 144 tiles. Flowers revealed on draw and replaced from the wall tail.
  Wall exhaustion = goulash draw: no payments, dealer repeats the hand.
- Turn flow: draw → optional self-actions (win, concealed gong, added gong) →
  discard → claim window. Every player who can legally claim the discard is
  prompted (Win / Pung / Gong / Chow, chow from the next seat only) and must
  answer or pass. The server resolves once all eligible seats respond,
  priority Win > Pung/Gong > Chow. Multiple simultaneous winners: closest to
  discarder in turn order wins. No auto-pass; the timer only nudges.
- Winds and dealer: East starts, dealer repeats on win or goulash, wind
  advances when the deal passes off the last seat. 2–3 player rooms use the
  same wall and rules with the missing winds skipped.
- Faan patterns: common hand (all chows), all pungs, mixed one suit, pure one
  suit, all honors, small/great dragons, small/great winds, seat wind pung,
  round wind pung, dragon pungs, flowers (1 each, bonus for own complete set),
  no flowers, self-draw, last-tile win, robbing the gong, gong replacement
  win, heavenly hand, earthly hand (limit hands score 13).

## Wire protocol

JSON over one WebSocket per client.

- Client → server: `create`, `join`, `sit`, `start`, `discard`, `selfAction`,
  `claim`, `pass`, `rematch`.
- Server → client: full filtered snapshot after every accepted action, with a
  `seq` number to discard stale renders. Snapshot carries: own hand, opponents
  as tile counts plus open melds/flowers/discards, discard pool, wall count,
  scores, turn/phase, and any prompt open for this seat. Full snapshots, not
  deltas: state is a few KB and reconnect becomes "receive snapshot, render".
- Errors: rejected intents return `{type: "error", reason}` to the sender only.

## UI

- Table view, mobile-first: own hand along the bottom (tap to select, tap
  again to discard), opponents on the other sides, discard pool and wall
  count in the center, melds and flowers fanned by each seat.
- Claim prompts as large overlay buttons. Timer drawn as a draining ring on
  the active seat.
- Tiles from an open-source SVG set; if none covers flowers well, render
  glyphs onto a styled tile face.
- Sounds: draw/discard clack, call stings, win sting. Mute toggle.
- Win screen: winning hand laid out, itemized faan list, payment arrows,
  running scores.
- Apply the frontend-design skill during implementation.

## Testing

- Engine carries most of the budget: `bun test` over winning and non-winning
  hands, every faan pattern, claim priority races, flower replacement, gong
  edge cases (robbing, replacement draw), wall exhaustion, 2–3 player
  rotation.
- Server: WS integration tests where scripted fake clients play a hand and a
  reconnect mid-hand resumes.
- E2E: one Playwright happy path with four browser contexts.

## Deploy

- Dockerfile (bun base image) building web/dist and running server/.
- Service added to waypoint's docker-compose on the external `edge` network.
- Caddy vhost `mahjong.harrys.monster → mahjong:3000`; WebSockets need no
  extra Caddy config. DNS A record for the subdomain.
- Deploy = rsync repo to `/root/mahjong/` + `docker compose up -d --build`,
  same as analytics.
- Analytics snippet pasted per SNIPPET.md, CSP hash recomputed.

## Out of scope for v1

Accounts, stats, leaderboards, chat, bots, spectators, game persistence
across restarts, riichi or other variants.
