// Test-environment mocks for the jest-expo (components) project.
// Native modules aren't linked under jest, so libraries that touch
// NativeModules at import time need their official jest mocks here.

// Official mock per https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
// Without it, any component that (transitively) imports AsyncStorage —
// e.g. contexts/theme-context.tsx — throws "NativeModule: AsyncStorage is null".
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// jest-expo's preset setup requires `expo/src/winter`, which installs LAZY
// global getters (URL, structuredClone, __ExpoImportMetaRegistry, ...) whose
// first access calls require(). Under Jest 30, that first access can happen
// outside the test-code scope (e.g. babel-preset-expo rewrites `import.meta`
// to `globalThis.__ExpoImportMetaRegistry`), throwing:
//   "You are trying to `import` a file outside of the scope of the test code."
// Touch each lazy global now — while requires are in scope — so the getters
// resolve eagerly and replace themselves with plain values.
for (const name of [
  'TextDecoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
  '__ExpoImportMetaRegistry',
  'structuredClone',
]) {
  void globalThis[name];
}
