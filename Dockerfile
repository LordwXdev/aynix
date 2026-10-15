# Aynix API: built in steps so the final image is small and has no build tools
# (step order matters: dependencies are copied before code, so Docker can reuse
#  the slow "npm ci" step when only the code changed = build caching)

# ---- 1. install all dependencies ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2. build: generate the database client and compile TypeScript ----
FROM deps AS build
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build

# this step also runs the database migrations (it has the Prisma CLI)
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- 3. production dependencies only ----
FROM node:22-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- 4. the image that actually runs ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# never run as root inside the container
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/app.js"]
