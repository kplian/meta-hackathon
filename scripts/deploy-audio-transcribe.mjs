// Deploy the audio-transcribe edge function to Supabase.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = 'audio-transcribe';

function envFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match) return [];
        const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
        return [[match[1], value]];
      })
  );
}

function cli(args) {
  const env = { ...process.env };
  const token =
    env.SUPABASE_ACCESS_TOKEN ||
    envFile('.env.cloud').SUPABASE_ACCESS_TOKEN ||
    envFile('.env').SUPABASE_ACCESS_TOKEN;
  if (token) env.SUPABASE_ACCESS_TOKEN = token;

  const result = spawnSync('npx', ['--no-install', 'supabase', ...args], {
    cwd: root,
    stdio: 'inherit',
    env,
  });
  if (result.error || result.status !== 0) {
    throw new Error('Supabase CLI command failed. Check authentication and project access.');
  }
}

try {
  const cloud = { ...envFile('.env.cloud'), ...envFile('apps/mobile/.env.cloud') };
  const urlStr = cloud.EXPO_PUBLIC_SUPABASE_URL || cloud.SUPABASE_URL || 'https://ywibmualqaipmygmrojz.supabase.co';
  const url = new URL(urlStr);
  const project = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] || 'ywibmualqaipmygmrojz';

  console.log(`Deploying ${target} to project ${project}...`);
  cli(['functions', 'deploy', target, '--project-ref', project, '--use-api', '--no-verify-jwt']);
  console.log(`${target} deployed successfully.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

