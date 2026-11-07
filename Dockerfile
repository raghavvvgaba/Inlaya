FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM base AS builder
ENV SKIP_ENV_VALIDATION=1
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Schema, migrations and the Prisma CLI so pending migrations are applied on
# startup (Render's free tier has no pre-deploy command). The standalone output
# doesn't include either. Keep the CLI version in sync with package.json.
COPY --from=builder /app/prisma ./prisma
RUN npm install -g prisma@6.19.3 && npm cache clean --force

EXPOSE 3000
# Applies only migrations not yet recorded in the database (a no-op when there
# are none), then starts the server. If a migration fails, the server doesn't
# start. Needs DIRECT_URL (unpooled) alongside DATABASE_URL.
CMD ["sh", "-c", "prisma migrate deploy && exec node server.js"]
