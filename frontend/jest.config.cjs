module.exports = {
  rootDir: ".",
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/test/**/*.test.{ts,tsx}"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  transform: { "^.+\\.[tj]sx?$": "babel-jest" },
  moduleNameMapper: { "\\.(css)$": "<rootDir>/test/styleMock.cjs" },
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/main.tsx",
    "!src/icons.tsx"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "html", "lcov"]
};
