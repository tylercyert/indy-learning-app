const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'dist-*/**', 'coverage/**', 'server/drizzle/**', 'data/**', '.expo/**', '.claude/**', 'qa/out/**'] },
]);
