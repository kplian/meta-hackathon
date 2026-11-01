# Supabase Cloud Deployment & Environment Management Guide

This document describes how to deploy migrations to Supabase Cloud and seamlessly switch the mobile frontend between Local (Docker) and Cloud environments.

---

## 1. Prerequisites

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Take note of:
   - **Project Reference ID** (`Project Settings > General`).
   - **Database Password** (defined during project creation).
   - **Project URL & Anon Key** (`Project Settings > API`).

---

## 2. Linking Local Project to Supabase Cloud (One-Time Setup)

From the project root:

```bash
# 1. Login to Supabase CLI
npx supabase login

# 2. Link your local repository to your remote project
npm run db:link -- --project-ref YOUR_PROJECT_REF
```
*(Enter your database password when prompted).*

This creates the remote link in `supabase/.temp/project-ref` (gitignored).

---

## 3. Deploying Migrations to Supabase Cloud

The migration files in `supabase/migrations/` represent the source of truth for database schema and catalogs.

```bash
# Preview pending migrations without executing (recommended before pushing)
npm run db:push:dry-run

# Apply all pending migrations to the linked Supabase Cloud project
npm run db:push

# (Optional) Update TypeScript types directly from the remote cloud schema
npm run db:types:cloud
```

---

## 4. Switching the Mobile App (Local vs Cloud)

The mobile app configuration in `apps/mobile` can be switched instantly using npm scripts:

### To switch to Cloud:
1. Open `apps/mobile/.env.cloud` (or let `npm run mobile:use-cloud` initialize it from `.env.cloud.example`).
2. Set your real credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_cloud_anon_key
   ```
3. Run:
   ```bash
   npm run mobile:use-cloud
   ```
4. Restart your Metro bundler (`npm run mobile:start`).

### To switch back to Local:
```bash
npm run mobile:use-local
```
Then restart your Metro bundler.

---

## 5. Visual Indicator in App

When running the mobile app, navigate to the **Profile** tab to view the active backend status card:
- **Local (Docker)**: Shows amber indicator and `http://localhost:54321`.
- **Supabase Cloud**: Shows green indicator and `https://<project-ref>.supabase.co`.

