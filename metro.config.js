// metro.config.js — HoloSpace Baseline
// Resuelve la incompatibilidad de expo-sqlite en plataforma web
// y fuerza a Zustand a usar CommonJS (evitando import.meta en ESM bajo Metro Web).

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Agregar soporte para archivos .wasm (evita error "unknown extension")
config.resolver.assetExts = config.resolver.assetExts || [];
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// En plataforma web:
// 1. Redirigir expo-sqlite al stub sin-operacion (evita crash de wa-sqlite.wasm)
// 2. Redirigir zustand a su distribucion CJS (evita error SyntaxError: Cannot use 'import.meta' outside a module)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName === 'expo-sqlite') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'modules/scanban/src/db/sqliteWebStub.js'),
      };
    }
    if (moduleName === 'zustand') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'node_modules/zustand/index.js'),
      };
    }
    if (moduleName === 'zustand/vanilla') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'node_modules/zustand/vanilla.js'),
      };
    }
    if (moduleName === 'zustand/traditional') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'node_modules/zustand/traditional.js'),
      };
    }
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

