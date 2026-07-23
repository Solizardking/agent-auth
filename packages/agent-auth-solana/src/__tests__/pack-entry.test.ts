import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("package publish entry points (structural)", () => {
  it("package.json points main/types/exports only at dist/", () => {
    const pkg = JSON.parse(
      readFileSync(join(pkgRoot, "package.json"), "utf8"),
    ) as {
      main: string;
      types: string;
      files: string[];
      exports: Record<string, { import: { types: string; default: string } }>;
    };

    expect(pkg.main).toMatch(/^\.\/dist\//);
    expect(pkg.types).toMatch(/^\.\/dist\//);
    expect(pkg.files).toContain("dist");
    expect(pkg.files).not.toContain("src");

    for (const [subpath, entry] of Object.entries(pkg.exports)) {
      expect(entry.import.default, subpath).toMatch(/^\.\/dist\//);
      expect(entry.import.types, subpath).toMatch(/^\.\/dist\//);
      expect(entry.import.default).not.toMatch(/src\//);
      expect(entry.import.types).not.toMatch(/src\//);
    }
  });

  it("built dist artifacts exist for advertised exports after build", () => {
    const required = [
      "dist/index.js",
      "dist/index.d.ts",
      "dist/client.js",
      "dist/client.d.ts",
      "dist/verify.js",
      "dist/verify.d.ts",
    ];
    for (const rel of required) {
      expect(existsSync(join(pkgRoot, rel)), `missing ${rel}`).toBe(true);
    }
  });
});
