/**
 * Utility script to switch frontend environment configuration between Local and Cloud.
 * Usage:
 *   node scripts/switch-env.js local
 *   node scripts/switch-env.js cloud
 */

const fs = require('fs');
const path = require('path');

const target = (process.argv[2] || '').toLowerCase().trim();
const validTargets = ['local', 'cloud'];

if (!validTargets.includes(target)) {
  console.error(`Invalid target "${target}". Expected "local" or "cloud".`);
  console.log('Usage:');
  console.log('  npm run mobile:use-local');
  console.log('  npm run mobile:use-cloud');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const mobileDir = path.join(rootDir, 'apps', 'mobile');
const destFile = path.join(mobileDir, '.env');
const localOverrideFile = path.join(mobileDir, '.env.local');

// Source files
const localSourceFile = path.join(mobileDir, '.env.local.config');
const cloudSourceFile = path.join(mobileDir, '.env.cloud');
const cloudExampleFile = path.join(mobileDir, '.env.cloud.example');

// Migrate existing .env.local to .env.local.config so it doesn't conflict with Expo's .env.local override mechanism
if (fs.existsSync(localOverrideFile) && !fs.existsSync(localSourceFile)) {
  const localContent = fs.readFileSync(localOverrideFile, 'utf8');
  if (localContent.includes('localhost') || localContent.includes('127.0.0.1')) {
    fs.writeFileSync(localSourceFile, localContent, 'utf8');
  }
}

// Fallback to .env.example if localSourceFile does not exist
if (!fs.existsSync(localSourceFile)) {
  const exampleLocal = path.join(mobileDir, '.env.example');
  if (fs.existsSync(exampleLocal)) {
    fs.copyFileSync(exampleLocal, localSourceFile);
  }
}

// Auto-create cloud source file from example if missing
if (!fs.existsSync(cloudSourceFile) && fs.existsSync(cloudExampleFile)) {
  fs.copyFileSync(cloudExampleFile, cloudSourceFile);
  console.log(`Initialized ${cloudSourceFile} from template.`);
}

const sourceFile = target === 'local' ? localSourceFile : cloudSourceFile;

if (!fs.existsSync(sourceFile)) {
  console.error(`Source configuration file not found: ${sourceFile}`);
  process.exit(1);
}

try {
  const content = fs.readFileSync(sourceFile, 'utf8');
  fs.writeFileSync(destFile, content, 'utf8');

  // CRITICAL: Remove apps/mobile/.env.local because Expo CLI (@expo/env)
  // treats .env.local as an override with higher priority than .env.
  // Having a stale .env.local pointing to localhost causes Expo to ignore .env in cloud mode.
  if (fs.existsSync(localOverrideFile)) {
    fs.unlinkSync(localOverrideFile);
  }

  console.log(`\n======================================================`);
  console.log(` Environment switched to: ${target.toUpperCase()}`);
  console.log(` Target file: apps/mobile/.env updated successfully.`);
  console.log(` Cleaned up conflicting .env.local overrides.`);
  console.log(`======================================================\n`);

  // Parse and display current EXPO_PUBLIC_SUPABASE_URL
  const match = content.match(/EXPO_PUBLIC_SUPABASE_URL=(.*)/);
  const currentUrl = match ? match[1].trim() : '(not found)';
  console.log(`Active Supabase URL: ${currentUrl}`);

  if (target === 'cloud' && currentUrl.includes('YOUR_PROJECT_REF')) {
    console.warn('\n[!] Warning: Please update apps/mobile/.env.cloud with your real Supabase Cloud URL and Anon Key.\n');
  } else if (target === 'local') {
    console.log('Ensure local Supabase is running with: npm run db:start\n');
  }
} catch (err) {
  console.error('Failed to switch environment:', err.message);
  process.exit(1);
}
