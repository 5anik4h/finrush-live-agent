import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Relax rules for specific files/patterns where the pattern is intentional
  {
    // AudioWorkletProcessor in public/ — required Web API method signature
    // includes params we intentionally don't use (outputs, parameters)
    files: ["public/audio/**/*.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
    },
  },
  {
    // Data-fetching components that use the established "fetch on mount +
    // realtime subscription" pattern. The set-state-in-effect rule is
    // over-broad here; this is the recommended Supabase realtime pattern.
    files: [
      "src/components/dashboard/BalanceSummary.tsx",
      "src/components/dashboard/TransactionHistory.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // useAudioStream uses ref-forwarding to break circular useCallback deps.
    // The immutability rule incorrectly flags ref.current mutations.
    files: ["src/hooks/useAudioStream.ts"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
