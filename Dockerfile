# Build every app, then keep only what the server needs at run time.
FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build && npm prune --omit=dev && rm -rf .turbo apps/*/src

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /data && chown node:node /data
USER node
ENV DATA_DIR=/data PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "server/index.js"]
