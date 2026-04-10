const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all packages in the monorepo
config.watchFolders = [monorepoRoot]

// Resolve modules from the monorepo root first, then the project
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Required for pnpm — follow symlinks so Metro can find workspace packages
config.resolver.unstable_enableSymlinks = true

// Stub out native-only modules on web
const WEB_STUBS = [
  'react-native-maps',
  'expo-task-manager',
]

const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS.some(stub => moduleName === stub || moduleName.startsWith(stub + '/'))) {
    return { type: 'empty' }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
