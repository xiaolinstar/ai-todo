/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    es2022: true,
  },
  globals: {
    // 微信小程序全局
    wx: 'readonly',
    App: 'readonly',
    Page: 'readonly',
    Component: 'readonly',
    Behavior: 'readonly',
    getApp: 'readonly',
    getCurrentPages: 'readonly',
    wxp: 'readonly',
  },
  ignorePatterns: [
    'miniprogram/**/*.js', // DevTools 编译产物
    'miniprogram/**/*.wxss',
    'miniprogram/**/*.wxml', // 模板不是 JS
    'miniprogram/**/*.json', // 配置不是 JS
    'node_modules/',
    'dist/',
    '.preview/',
    'types/', // 类型声明文件
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // 调试需要 console
  },
};
