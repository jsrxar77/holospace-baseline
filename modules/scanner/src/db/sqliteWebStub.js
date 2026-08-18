// Stub de expo-sqlite para plataforma web.
// En web, localDatabase.ts usa la ruta Platform.OS === 'web' (memoria/servidor),
// por lo que expo-sqlite nunca se llama realmente.
// Este stub evita que Metro bundler falle al intentar resolver wa-sqlite.wasm.

module.exports = {
  openDatabaseAsync: () => {
    console.warn('[sqliteWebStub] expo-sqlite no está disponible en web. Usando fallback de servidor.');
    return null;
  },
  openDatabase: () => null,
};
