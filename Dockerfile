FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG PUBLIC_FORMSPREE_ENDPOINT
ENV PUBLIC_FORMSPREE_ENDPOINT=${PUBLIC_FORMSPREE_ENDPOINT}

RUN npm run build

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

CMD ["sh", "-c", "node ./scripts/run-migrations.mjs && node ./dist/server/entry.mjs"]
