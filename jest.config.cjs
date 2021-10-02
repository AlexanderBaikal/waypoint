/* eslint-env node */
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.app.json", useESM: false }],
  },
  moduleNameMapper: {
    "\\.(css|webp|png|svg)$": "identity-obj-proxy",
  },
  // scripts/ is build tooling, but the parsing and ranking logic there is
  // tested like anything else.
  testMatch: ["<rootDir>/src/**/*.test.(ts|tsx)", "<rootDir>/scripts/**/*.test.mjs"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}", "!src/test/**"],
};
