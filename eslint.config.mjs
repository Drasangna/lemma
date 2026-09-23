import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // components/ui is vendored shadcn code; drizzle holds generated migrations.
  { ignores: [".vinext/**", ".next/**", "dist/**", "drizzle/**", "vendor/**", "components/ui/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
);
