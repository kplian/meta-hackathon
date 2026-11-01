/**
 * Links the local Supabase CLI to the Cloud project specified in apps/mobile/.env.cloud.
 * Usage:
 *   npm run db:link
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const envCloudPath = path.resolve(__dirname, '..', 'apps', 'mobile', '.env.cloud');

if (!fs.existsSync(envCloudPath)) {
  console.error(`Error: "${envCloudPath}" not found.`);
  console.error('Please create apps/mobile/.env.cloud with your EXPO_PUBLIC_SUPABASE_URL first.');
  process.exit(1);
}

const content = fs.readFileSync(envCloudPath, 'utf8');
const match = content.match(/EXPO_PUBLIC_SUPABASE_URL=(.*)/);

if (!match || !match[1].trim()) {
  console.error('Error: EXPO_PUBLIC_SUPABASE_URL not defined in apps/mobile/.env.cloud.');
  process.exit(1);
}

const rawUrl = match[1].trim();
let projectRef = '';

// Extract ref from https://<ref>.supabase.co or dashboard URL
if (rawUrl.includes('.supabase.co')) {
  projectRef = rawUrl.replace('https://', '').replace('http://', '').split('.supabase.co')[0];
} else if (rawUrl.includes('/project/')) {
  projectRef = rawUrl.split('/project/')[1].split('/')[0].split('?')[0];
} else {
  projectRef = rawUrl;
}

if (!projectRef || projectRef === 'YOUR_PROJECT_REF') {
  console.error(`Invalid project reference: "${projectRef}".`);
  console.error('Please set your real project URL or reference ID in apps/mobile/.env.cloud.');
  process.exit(1);
}

console.log(`\n======================================================`);
console.log(` Linking Supabase CLI to Cloud Project: ${projectRef}`);
console.log(`======================================================\n`);

const args = ['supabase', 'link', '--project-ref', projectRef];

// Forward any additional flags passed by user (e.g. --debug)
const extraArgs = process.argv.slice(2);
if (extraArgs.length > 0) {
  args.push(...extraArgs);
}

const child = spawn('npx', args, {
  stdio: 'inherit',
});

child.on('close', (code) => {
  if (code === 0) {
    console.log(`\n Project ${projectRef} successfully linked!`);
    console.log(`You can now deploy your migrations using: npm run db:push\n`);
  } else {
    process.exit(code || 1);
  }
});
