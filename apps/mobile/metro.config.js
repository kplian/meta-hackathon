// Monorepo-aware Metro config with NativeWind support:
// - watchFolders lets the bundler resolve workspace packages
//   (e.g. @meta-hackathon/database-types) symlinked at the repo root.
// - withNativeWind compiles the Tailwind classes in global.css.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
