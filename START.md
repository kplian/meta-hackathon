# Quick Start Guide

## 1. Start Supabase (Backend)

Ensure Docker Desktop is running, then execute:

```bash
# Start local Supabase services (API: http://localhost:54321, Studio: http://localhost:54323)
npm run db:start

# (Optional) Reset database, apply all migrations and load seed data
npm run db:reset
```

## 2. Start Mobile App (Frontend)

In a new terminal window, run:

```bash
# Start Expo Metro Bundler
npm run mobile:start
```

### Platform options:

```bash
npm run mobile:web      # Open directly in Web browser
npm run mobile:ios      # Open on iOS simulator (macOS only)
npm run mobile:android  # Open on Android emulator
```

## 3. Switch Mobile App Backend (Local vs Cloud)

Easily switch the frontend target between your local Docker instance and Supabase Cloud:

```bash
# Switch to Local Backend (http://localhost:54321)
npm run mobile:use-local

# Switch to Cloud Backend (uses config from apps/mobile/.env.cloud)
npm run mobile:use-cloud
```

> **Note:** When using `npm run mobile:use-cloud` for the first time, edit `apps/mobile/.env.cloud` and provide your remote `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## 4. Deploy Migrations to Supabase Cloud

Deploy your versioned migrations to your hosted Supabase Cloud project:

```bash
# 1. Link your local repository to your remote project (one-time setup)
npm run db:link -- --project-ref YOUR_PROJECT_REF

# 2. Preview pending migrations (dry-run)
npm run db:push:dry-run

# 3. Apply pending migrations to the cloud database
npm run db:push

# 4. (Optional) Generate TypeScript types from the linked cloud database
npm run db:types:cloud
```


