FROM node:20-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set registry https://registry.npmjs.org/

FROM base AS deps

COPY package*.json ./
RUN npm ci

FROM base AS builder

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
