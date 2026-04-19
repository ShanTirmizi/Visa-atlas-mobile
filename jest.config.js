module.exports = {
  projects: [
    {
      // Logic tests: pure TS, no RN/Expo runtime.
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/constants/**/*.test.ts',
        '<rootDir>/utils/**/*.test.ts',
        '<rootDir>/components/**/*.physics.test.ts',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
    },
    {
      // Component tests: Expo/RN runtime via jest-expo.
      displayName: 'components',
      preset: 'jest-expo',
      testMatch: [
        '<rootDir>/components/**/__tests__/**/*.test.(ts|tsx)',
        '<rootDir>/app/**/__tests__/**/*.test.(ts|tsx)',
      ],
      transformIgnorePatterns: [
        'node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|@gorhom/.*|lucide-react-native|country-flag-icons)',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      setupFilesAfterEach: ['@testing-library/jest-native/extend-expect'],
    },
  ],
};
