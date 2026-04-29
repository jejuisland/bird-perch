const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo so Metro resolves workspace packages
config.watchFolders = [workspaceRoot];

// Resolve packages from both the app and monorepo root node_modules,
// including pnpm's virtual store so symlinked deps are found correctly
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// pnpm uses symlinks; Metro must follow them to resolve deps
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
