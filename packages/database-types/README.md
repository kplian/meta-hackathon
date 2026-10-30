# Shared Supabase types

Generated database types, shared by every app in the monorepo via the
`@meta-hackathon/database-types` workspace package.

Regenerate after any schema change:

```bash
npm run db:types
```

This runs `supabase gen types` against the local stack and overwrites
`src/database.types.ts`. Commit the result so all apps stay in sync.
