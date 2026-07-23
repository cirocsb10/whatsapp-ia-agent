/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  // jest-dom matchers (toBeInTheDocument etc.) só se aplicam a testes de componente
  // (.test.tsx), que declaram `@jest-environment jsdom` no topo do arquivo.
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  rootDir: ".",
};
