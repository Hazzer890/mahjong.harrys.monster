FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN cd web && bun install && bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/engine engine
COPY --from=build /app/server server
COPY --from=build /app/web/dist web/dist
EXPOSE 3000
CMD ["bun", "server/index.ts"]
