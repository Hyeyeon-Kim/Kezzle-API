FROM node:22.23.1-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22.23.1-slim AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

FROM node:22.23.1-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json package-lock.json ./

USER node

EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=5s --timeout=2s --start-period=15s --retries=6 \
  CMD ["node", "-e", "const port = process.env.PORT ?? 3000; fetch('http://127.0.0.1:' + port + '/health/ready').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]
CMD ["node", "dist/main"]
