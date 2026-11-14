const fs = require('node:fs');
const path = require('node:path');

const coveredFolders = ['src/domain', 'src/data'];
const threshold = { lines: 90, branches: 90 };

function isSource(file) {
  return /\.tsx?$/.test(file) && !/\.(test|d)\.tsx?$/.test(file);
}

function containsSource(folder) {
  const absolute = path.join(__dirname, folder);
  return fs.existsSync(absolute) && fs.readdirSync(absolute, { recursive: true }).some(isSource);
}

// Jest fails when a threshold path matches no file, so a folder gets its threshold once it has code.
const coverageThreshold = Object.fromEntries(
  coveredFolders.filter(containsSource).map((folder) => [`./${folder}/`, threshold]),
);

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*))',
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/*.d.ts',
    '!src/domain/arbitraries.ts',
  ],
  coverageThreshold,
};
