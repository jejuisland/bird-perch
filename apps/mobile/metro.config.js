const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo AND the pnpm virtual store (C:/s),
// which is outside the workspace root since we set virtual-store-dir=C:/s
config.watchFolders = [workspaceRoot, 'C:/s'];

// Resolve packages from both the app and monorepo root node_modules,
// including pnpm's virtual store so symlinked deps are found correctly
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// pnpm uses symlinks; Metro must follow them to resolve deps
config.resolver.unstable_enableSymlinks = true;

// react-native-svg-transformer: import .svg files as React components
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
