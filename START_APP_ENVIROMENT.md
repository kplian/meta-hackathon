# Starting the Application Environment

Quick guide to run the application targeting either **Local Supabase** (Docker) or **Supabase Cloud**.

---

## Prerequisites

- **Node.js**: v24 LTS and `npm`
- **Docker / Colima**: Required only for local Supabase execution
- **Supabase CLI**: Required for local stack commands

---

## 1. Local Supabase Environment

Follow these steps to run everything locally on your machine using Docker.

### Step 1: Start Database & Configure Local Demo
Run the automated local setup command:
```bash
npm run local:setup
```
This single command:
1. Starts the local Supabase Docker containers (`supabase start`).
2. Applies all database migrations and seeds.
3. Automatically sets `apps/mobile/.env` with your local Supabase URL and anon key.
4. Verifies/creates the demo user credentials (`valentina@demo.local`).

*(Alternatively, to explicitly switch the configuration: `npm run mobile:use-local`)*

### Step 2: Start the Frontend
In a new terminal:
```bash
npm run mobile:web
```
- Open [http://localhost:8090](http://localhost:8090) in your browser.
- Click **"Acceder en modo demo (Valentina)"** to log in with test data.

### Local Services Reference
- **Frontend App**: [http://localhost:8090](http://localhost:8090)
- **Supabase Studio (Dashboard)**: [http://localhost:54323](http://localhost:54323)
- **Supabase API Gateway**: [http://127.0.0.1:54321](http://127.0.0.1:54321)

---

## 2. Supabase Cloud Environment

Follow these steps to connect the frontend to a hosted Supabase project.

### Step 1: Configure Cloud Credentials
Create or edit `apps/mobile/.env.cloud`:
```bash
# If apps/mobile/.env.cloud does not exist, copy the template:
cp apps/mobile/.env.cloud.example apps/mobile/.env.cloud
```
Update `apps/mobile/.env.cloud` with your project's credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_CLOUD_ANON_KEY
```

### Step 2: Switch Frontend Environment to Cloud
Run the environment switcher script:
```bash
npm run mobile:use-cloud
```
This updates `apps/mobile/.env` with the values from `.env.cloud`.

### Step 3: Synchronize or Reset Database in Cloud

Depending on what you want to achieve with the remote database:

- **Option A: Full Reset (Recommended if objects/tables are missing or out of sync)**
  Recreates the remote schema from scratch, applies all migrations in order, and runs `supabase/seed.sql`:
  ```bash
  npm run db:reset:cloud
  ```
  *(Prompts for confirmation and your Supabase database password).*

- **Option B: Apply Pending Migrations (Without deleting existing data)**
  Pushes only the new/unapplied migration files from `supabase/migrations/`:
  ```bash
  npm run db:push
  ```

- **(Optional) Load Demo Data in Cloud**:
  If you want the demo household, members, and example transactions (Valentina):
  Copy the contents of `supabase/seed.demo.sql` and run them in the **SQL Editor** of your [Supabase Cloud Dashboard](https://supabase.com/dashboard).

### Step 4: Start the Frontend (with clean cache)
1. If Metro was already running, **stop it** by pressing `Ctrl + C` in the terminal.
2. Start the web frontend clearing Metro's bundler cache:
```bash
npm run mobile:web -- --clear
```
- Open [http://localhost:8090](http://localhost:8090) in your browser.
- **Sign Out / Hard Refresh**: If you were previously logged in to Local Docker, click **"Sign out"** or perform a hard refresh (`Cmd + Shift + R` / `Ctrl + Shift + R`) to purge old local auth tokens.

---

## Quick Reference Summary

| Target | Switch Command | Database Setup | Launch Frontend |
| :--- | :--- | :--- | :--- |
| **Local (Docker)** | `npm run mobile:use-local` | `npm run local:setup` | `npm run mobile:web -- --clear` |
| **Cloud (Hosted)** | `npm run mobile:use-cloud` | `npm run db:link` *(optional)* | `npm run mobile:web -- --clear` |

---

## Troubleshooting: Profile Still Shows "Local (Docker)"

If the Profile tab still displays `Local (Docker)`:

1. **Conflicting `.env.local` file was present**:
   Expo CLI natively gives higher priority to `.env.local` over `.env`. If a stale `apps/mobile/.env.local` existed on disk, Expo loaded it and silently overrode your Cloud `.env`.
   Run:
   ```bash
   npm run mobile:use-cloud
   ```
   The updated switch script now automatically removes conflicting `.env.local` overrides.

2. **Metro dev server was not restarted**:
   Expo/Metro reads `EXPO_PUBLIC_*` variables once at process startup. Stop the dev server (`Ctrl + C`) and start it again with cache clear:
   ```bash
   npm run mobile:web -- --clear
   ```

3. **Browser cached old bundle or auth token**:
   - Perform a hard refresh in your browser (`Cmd + Shift + R` on Mac, `Ctrl + F5` on Windows/Linux).
   - If an old session is active, click **Sign out** at the bottom of the Profile screen to clear the local storage tokens from Docker.

4. **Verify the active Supabase URL loaded by Expo**:
   ```bash
   node -e "const { load } = require('@expo/env'); console.log(load('./apps/mobile').EXPO_PUBLIC_SUPABASE_URL);"
   ```
   It should output your cloud project URL: `https://<your-project-ref>.supabase.co`.

> **Note**: Always restart the Expo / Metro bundler process after switching environments so that the newly updated `.env` file is loaded into the bundle.

