FROM node:20-alpine AS base

WORKDIR /app

RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set registry https://registry.npmjs.org/

FROM base AS build-deps

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

FROM base AS build

COPY --from=build-deps /app/node_modules ./node_modules
COPY --from=build-deps /app/prisma ./prisma
COPY . .

RUN npm run build

FROM base AS prod-deps

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && npx prisma generate

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p uploads

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push && node dist/src/main.js"]
