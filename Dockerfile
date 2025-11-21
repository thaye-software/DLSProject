# syntax=docker/dockerfile:1.4

# Multi-stage Dockerfile for a Next.js app (production)
# - Stage 1: deps -> install dependencies (with BuildKit cache for npm)
# - Stage 2: builder -> build the Next.js app
# - Stage 3: runner -> minimal runtime image

############################
# Base image (Node 24 as requested)
############################
FROM node:24-slim AS base
WORKDIR /app

############################
# Install deps (with build tools in case native modules are needed)
# Uses BuildKit cache mount for npm to speed repeated installs in CI
############################
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
# Use BuildKit cache for npm cache to accelerate installs across builds
# Run a small Node check to ensure package-lock.json is present and contains a valid lockfileVersion
RUN --mount=type=cache,target=/root/.npm \
  sh -lc 'if [ -f package-lock.json ] && node -e "try{const p=require(\"./package-lock.json\"); process.exit(p && p.lockfileVersion>=1?0:2)}catch(e){process.exit(1)}"; then \
    npm ci --prefer-offline --no-audit --progress=false; \
  else \
    npm install --no-audit --progress=false; \
  fi'

############################
# Build the app
############################
FROM base AS builder
WORKDIR /app

# Reuse installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy source
COPY . .
# Build the Next.js app
# Use BuildKit secret mounts so different secrets can be provided by the workflow
# (e.g. database_url_dev or database_url_prod). Mounts that aren't provided will
# simply not create files, so we check for each possible secret and use the first
# one we find. We also optionally read an `app_env` secret if provided.
RUN --mount=type=secret,id=database_url_prod \
    --mount=type=secret,id=database_url_dev \
    --mount=type=secret,id=app_env \
    --mount=type=secret,id=supabase_url \
    --mount=type=secret,id=supabase_key \
    --mount=type=secret,id=stripe_secret_key \
    --mount=type=secret,id=stripe_public_key \
    --mount=type=secret,id=resend_key \
    --mount=type=secret,id=resend_origin_email_key \
    --mount=type=secret,id=posthog_key \
    --mount=type=secret,id=posthog_host \
    sh -c 'if [ -f /run/secrets/database_url_prod ]; then DATABASE_URL_PROD="$(cat /run/secrets/database_url_prod)"; elif [ -f /run/secrets/database_url_dev ]; then DATABASE_URL_DEV="$(cat /run/secrets/database_url_dev)"; fi; if [ -f /run/secrets/app_env ]; then APP_ENV="$(cat /run/secrets/app_env)"; echo "Build app_env=$APP_ENV"; fi; if [ -f /run/secrets/supabase_url ]; then NEXT_PUBLIC_SUPABASE_URL="$(cat /run/secrets/supabase_url)"; fi; if [ -f /run/secrets/supabase_key ]; then NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(cat /run/secrets/supabase_key)"; fi; if [ -f /run/secrets/stripe_secret_key ]; then STRIPE_SECRET_KEY="$(cat /run/secrets/stripe_secret_key)"; fi; if [ -f /run/secrets/stripe_public_key ]; then NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$(cat /run/secrets/stripe_public_key)"; fi; if [ -f /run/secrets/resend_key ]; then RESEND_API_KEY="$(cat /run/secrets/resend_key)"; fi; if [ -f /run/secrets/resend_origin_email_key ]; then RESEND_ORIGIN_EMAIL="$(cat /run/secrets/resend_origin_email_key)"; fi; if [ -f /run/secrets/posthog_key ]; then POSTHOG_API_KEY="$(cat /run/secrets/posthog_key)"; NEXT_PUBLIC_POSTHOG_KEY="$(cat /run/secrets/posthog_key)"; fi; if [ -f /run/secrets/posthog_host ]; then POSTHOG_HOST="$(cat /run/secrets/posthog_host)"; NEXT_PUBLIC_POSTHOG_HOST="$(cat /run/secrets/posthog_host)"; fi; export DATABASE_URL_PROD DATABASE_URL_DEV APP_ENV NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY STRIPE_SECRET_KEY NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY RESEND_API_KEY RESEND_ORIGIN_EMAIL POSTHOG_API_KEY POSTHOG_HOST NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_POSTHOG_HOST; npm run build'

############################
# Production image
############################
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy only what's needed to run the app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
# Tini location on Debian/Ubuntu-based images
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["npm","start"]
