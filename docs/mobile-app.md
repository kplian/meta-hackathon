# Mobile App (Expo + React Native + TypeScript)

Native companion app for the AI Family Budget Assistant, living in `apps/mobile`.
It talks to the same Supabase backend as the n8n AI Agents.

## Prerequisites

- Node.js 18+ and npm
- Supabase local stack (`npm run db:start` from the repo root)
- Expo Go on your phone, or an Android emulator / iOS simulator

## Setup

```bash
# 1. Install all workspace dependencies (from the repo root)
npm install

# 2. Configure the mobile env vars
cp apps/mobile/.env.example apps/mobile/.env
# Edit apps/mobile/.env with your SUPABASE_URL / ANON_KEY (see `supabase status`)

# 3. Start the app
npm run mobile:start
```

Then scan the QR code with Expo Go, or press `a` / `i` for emulator/simulator.

## Monorepo notes

- The repo uses **npm workspaces** (`apps/*`, `packages/*`). Always run `npm install`
  from the repo root so dependencies hoist correctly.
- Shared Supabase types live in `@meta-hackathon/database-types`
  (`packages/database-types`). The app imports them directly:
  `import type { Database } from '@meta-hackathon/database-types'`.
- After any DB schema change, regenerate types from the root:
  `npm run db:types`.
- `metro.config.js` sets `watchFolders` to the repo root so Metro can resolve
  the symlinked workspace packages.

## Auth flow

- `App.tsx` gates on the Supabase session (`src/hooks/useSession`): no session
  renders `LoginScreen`, an active session renders `HomeScreen`.
- `LoginScreen` (`src/screens/LoginScreen.tsx`, styled with NativeWind/Tailwind)
  supports email + password sign-in/sign-up, Google OAuth via the system
  browser, and a demo-mode button that signs in with `EXPO_PUBLIC_DEMO_EMAIL` /
  `EXPO_PUBLIC_DEMO_PASSWORD`.
- Setup: create the demo user once in Supabase Studio (Authentication > Add
  user) with the values from `apps/mobile/.env`. Google sign-in additionally
  requires the Google provider enabled in the Supabase dashboard.

## Backend requirements

- `supabase/config.toml` exposes the `budget` schema via the API
  (`schemas = [..., "budget"]`). Restart the stack after changing it:
  `npm run db:stop && npm run db:start`.
- All `budget.*` tables have RLS enabled but no per-user policies yet. The app's
  startup screen only calls `auth.getSession()` (no RLS involved). Before
  querying budget tables from the app, add RLS policies keyed to `auth.uid()`.

## Scripts

| Command (repo root)    | Description                    |
| :---                   | :---                           |
| `npm run mobile:start` | Start Expo dev server          |
| `npm run mobile:android` | Start + open Android         |
| `npm run mobile:ios`   | Start + open iOS               |
| `npm run mobile:typecheck` | Type-check the app (`tsc --noEmit`) |
