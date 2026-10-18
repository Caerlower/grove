/** Ensures arkiv-encryption resolves under tsx/CJS (exports only declared "import"). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let pkgPath;
try {
  pkgPath = require.resolve("arkiv-encryption/package.json");
} catch {
  // pnpm may not export package.json; fall back
  pkgPath = new URL("../node_modules/arkiv-encryption/package.json", import.meta.url)
    .pathname;
}
if (!existsSync(pkgPath)) {
  console.warn("patch-arkiv-encryption: package not found, skip");
  process.exit(0);
}
const j = JSON.parse(readFileSync(pkgPath, "utf8"));
j.exports = {
  ".": {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
    require: "./dist/index.js",
    default: "./dist/index.js",
  },
};
writeFileSync(pkgPath, JSON.stringify(j, null, 2) + "\n");
console.log("patched arkiv-encryption exports");
