# mahjong.harrys.monster

Hong Kong mahjong for 2-4 friends in a browser. No accounts: create a room,
get a 4-letter code, share `mahjong.harrys.monster/r/ABCD`. One Bun process
serves the API, the WebSocket, and the built frontend.

## Rules

Hong Kong / Cantonese variant, 144 tiles including 8 flowers. Full faan
counting with a host-configurable minimum (default 3, range 0-5). Points are
`2^faan`, capped at 13 faan (limit hand). The discarder pays the full amount
alone; on a self-draw everyone else pays. The host sets seats (2-4), game
length (single hand / one wind / full game), min faan, and turn timer at
room creation.

Games are in-memory only; a server restart ends active rooms.

## Development

```bash
bun test                              # engine + server + web unit tests
NODE_ENV=test bun server/index.ts     # run the server (test mode allows a fixed wall seed)
cd web && bun run dev                 # vite dev server
cd web && bun run e2e                 # playwright end-to-end tests
```

`engine/` and `server/` have no external dependencies. `web/` is a Vite +
React app; `bun run build` in `web/` outputs `web/dist`, which the server
serves as static files with an SPA fallback.

## Deploy

Docker compose on the waypoint VPS, behind Caddy on the shared `edge`
network:

```bash
rsync -a --exclude node_modules --exclude web/dist ./ root@167.233.225.99:/root/mahjong/
ssh root@167.233.225.99 'cd /root/mahjong && docker compose up -d --build'
```

Then, manually:

- Add a `mahjong.harrys.monster` vhost to `/root/waypoint/Caddyfile`
  (`reverse_proxy mahjong:3000`) and reload Caddy.
- Add a DNS A record for `mahjong.harrys.monster` at the registrar.

`web/index.html` already inlines the analytics snippet
(`analytics.harrys.monster`). Mahjong sets no CSP header, so it needs no
hash configuration.
