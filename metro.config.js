// Configuración de Metro. Solo hace falta para abrir la app en un navegador (pruebas en el ordenador):
// en web, expo-sqlite usa SQLite compilado a WebAssembly y necesita estas dos cosas.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Archivos .wasm como recursos.
config.resolver.assetExts.push('wasm');

// Cabeceras que permiten SharedArrayBuffer, que usa SQLite en el navegador.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
