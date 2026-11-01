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
const sourceFile = path.join(mobileDir, `.env.${target}`);
const exampleFile = path.join(mobileDir, `.env.${target}.example`);
const destFile = path.join(mobileDir, '.env');

// Auto-create source file from example if missing (for cloud)
if (!fs.existsSync(sourceFile) && fs.existsSync(exampleFile)) {
  fs.copyFileSync(exampleFile, sourceFile);
  console.log(`Initialized ${sourceFile} from template.`);
}

if (!fs.existsSync(sourceFile)) {
  console.error(`Source configuration file not found: ${sourceFile}`);
  process.exit(1);
}

try {
  const content = fs.readFileSync(sourceFile, 'utf8');
  fs.writeFileSync(destFile, content, 'utf8');

  console.log(`\n======================================================`);
  console.log(` Environment switched to: ${target.toUpperCase()}`);
  console.log(` Target file: apps/mobile/.env updated successfully.`);
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
