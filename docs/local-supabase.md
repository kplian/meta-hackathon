# Local Supabase

Run commands from `meta-hackathon` with Docker Desktop running:

```bash
npm install --workspaces=false
npm run db:start
npx supabase status
```

Supabase CLI manages the Docker containers and persistent volumes for project
`meta_hackathon`. The existing Compose file manages n8n separately.
On the first start, the CLI applies `supabase/migrations` and `supabase/seed.sql`.

| Client | Endpoint |
| --- | --- |
| Browser / local backend | `http://127.0.0.1:54321` |
| Supabase Studio | `http://127.0.0.1:54323` |
| PostgreSQL | host `127.0.0.1`, port `54322`, database `postgres` |
| n8n container / REST | `http://host.docker.internal:54321` |
| n8n container / PostgreSQL | host `host.docker.internal`, port `54322` |
| Physical phone | `http://<computer-LAN-IP>:54321` |

The local PostgreSQL username and password are both `postgres` by default.
Use schema `budget` for application data. For Supabase JS queries, use
`supabase.schema('budget').from('tuser')`, for example; access is governed by RLS.

Copy the local anonymous key from `npx supabase status` into
`SUPABASE_ANON_KEY` in `.env` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in
`apps/mobile/.env`. Set `EXPO_PUBLIC_SUPABASE_URL` to the appropriate API
endpoint above. Restart Expo after changing its environment.
Keep the service-role key in backend configuration only; never put it into
an `EXPO_PUBLIC_*` variable or commit environment files.

Google login additionally requires valid Google OAuth credentials and the local
callback URL `http://127.0.0.1:54321/auth/v1/callback` in the provider configuration.
Email/password authentication can be tested independently.

```bash
npm run db:stop       # Stop services and preserve local data
npm run db:start      # Start again
```

`npm run db:reset` deletes local application data and rebuilds it from migrations
and seed data. Back up any data you need before using it.
`npm run db:push` targets a linked remote project; it is not needed for local startup.

Reference: https://supabase.com/docs/guides/local-development/cli/getting-started
