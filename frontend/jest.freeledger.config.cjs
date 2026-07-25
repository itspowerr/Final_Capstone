module.exports = {
  rootDir: __dirname,
  roots: ['<rootDir>/src'],
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/src/testPolyfills.js', '<rootDir>/node_modules/react-app-polyfill/jsdom.js'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  testMatch: ['<rootDir>/src/**/*.test.js'],
  moduleNameMapper: {
    '^react-router-dom$': '<rootDir>/node_modules/react-router-dom/dist/index.js',
    '^react-router$': '<rootDir>/node_modules/react-router/dist/development/index.js',
    '^react-router/dom$': '<rootDir>/node_modules/react-router/dist/development/dom-export.js',
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': '<rootDir>/node_modules/react-scripts/config/jest/babelTransform.js',
    '^.+\\.css$': '<rootDir>/node_modules/react-scripts/config/jest/cssTransform.js',
    '^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)': '<rootDir>/node_modules/react-scripts/config/jest/fileTransform.js'
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
    '^.+\\.module\\.(css|sass|scss)$'
  ]
};


