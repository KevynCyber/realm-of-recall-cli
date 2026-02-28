import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["bin/ror.ts", "src/**/*.ts", "src/**/*.tsx"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node18",
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
