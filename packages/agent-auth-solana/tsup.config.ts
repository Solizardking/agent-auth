import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/client.ts", "src/verify.ts"],
  format: ["esm"],
  dts: true,
  splitting: true,
  clean: true,
  outDir: "dist",
  external: [
    "better-auth",
    "better-auth-solana",
    "@metaplex-foundation/mpl-agent-registry",
    "@metaplex-foundation/umi",
    "@metaplex-foundation/umi-bundle-defaults",
    "bs58",
    "tweetnacl",
  ],
});
