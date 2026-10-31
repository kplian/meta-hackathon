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

