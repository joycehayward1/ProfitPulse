const fs = require("fs");
const path = require("path");
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

// @insforge/sdk (CJS) depends on @insforge/shared-schemas, which is ESM-only
// (exports has no "require" condition). Point Jest at its ESM entry and let
// it be transformed. Next's bundler handles this in the app itself.
const sdkDir = path.join(__dirname, "node_modules/@insforge/sdk");
const nestedSchemas = path.join(sdkDir, "node_modules/@insforge/shared-schemas");
const schemasDir = fs.existsSync(nestedSchemas)
  ? nestedSchemas
  : path.join(__dirname, "node_modules/@insforge/shared-schemas");

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@insforge/shared-schemas$": path.join(schemasDir, "dist/index.js"),
  },
};

module.exports = async () => {
  const resolved = await createJestConfig(config)();
  resolved.transformIgnorePatterns = [
    "/node_modules/(?!(@insforge/(sdk|shared-schemas)|zod)/)",
    ...resolved.transformIgnorePatterns.filter((p) => !p.includes("node_modules")),
  ];
  return resolved;
};
