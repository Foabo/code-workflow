import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const srcRoot = path.join(process.cwd(), "src");
const capabilityDirs = new Set([
  "baseline",
  "cli",
  "domain",
  "enhancements",
  "harness",
  "project",
  "shared",
  "tasks",
  "workflow"
]);

const deepImportAllowlist = new Map<string, string>([
  ["src/tasks/paths.ts -> ../project/paths.js", "task paths compose the .ff project root without importing the project aggregate entry"],
  ["src/tasks/storage.ts -> ../project/paths.js", "task storage needs the archive directory name and root task directories"],
  ["src/tasks/lifecycle.ts -> ../project/paths.js", "task lifecycle writes task artifacts under the .ff project root without importing project validation"]
]);

describe("module boundaries", () => {
  it("keeps root src entries thin", async () => {
    const rootEntries = (await readdir(srcRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => entry.name)
      .sort();

    assert.deepEqual(rootEntries, ["agent-command.ts", "cli.ts", "index.ts"]);

    for (const entry of rootEntries) {
      const text = await readFile(path.join(srcRoot, entry), "utf8");
      assert.ok(text.split(/\r?\n/).length <= 25, `${entry} should stay a thin root entry`);
    }
  });

  it("keeps shared and domain independent from product capabilities", async () => {
    const sourceFiles = await listSourceFiles(srcRoot);
    for (const file of sourceFiles) {
      const capability = capabilityFor(file);
      if (capability !== "shared" && capability !== "domain") {
        continue;
      }
      for (const specifier of importSpecifiers(await readFile(file, "utf8"))) {
        const target = resolveSourceImport(file, specifier);
        if (target === null) {
          continue;
        }
        const targetCapability = capabilityFor(target);
        assert.ok(
          targetCapability === capability,
          `${relative(file)} must not import product capability ${targetCapability}: ${specifier}`
        );
      }
    }
  });

  it("routes cross-capability imports through public entries or documented exceptions", async () => {
    const sourceFiles = await listSourceFiles(srcRoot);
    for (const file of sourceFiles) {
      const capability = capabilityFor(file);
      if (capability === null) {
        continue;
      }
      for (const specifier of importSpecifiers(await readFile(file, "utf8"))) {
        const target = resolveSourceImport(file, specifier);
        if (target === null) {
          continue;
        }
        const targetCapability = capabilityFor(target);
        if (targetCapability === null || targetCapability === capability) {
          continue;
        }

        const key = `${relative(file)} -> ${specifier}`;
        const isPublicEntry = specifier === `../${targetCapability}/index.js` ||
          specifier === `./${targetCapability}/index.js`;
        assert.ok(
          isPublicEntry || deepImportAllowlist.has(key),
          `${key} crosses into ${targetCapability} without the public entry or allowlist`
        );
        if (deepImportAllowlist.has(key)) {
          assert.ok((deepImportAllowlist.get(key) ?? "").length > 20, `${key} allowlist needs a reason`);
        }
      }
    }
  });

  it("keeps test support reusable", async () => {
    const supportFiles = await listSourceFiles(path.join(process.cwd(), "tests/support"));
    for (const file of supportFiles) {
      const text = await readFile(file, "utf8");
      for (const specifier of importSpecifiers(text)) {
        assert.ok(!specifier.startsWith("../baseline/"), `${relative(file)} must not import a concrete test suite`);
        assert.ok(!specifier.startsWith("../enhancements/"), `${relative(file)} must not import a concrete test suite`);
        assert.ok(!specifier.startsWith("../harness/"), `${relative(file)} must not import a concrete test suite`);
        assert.ok(!specifier.startsWith("../project/"), `${relative(file)} must not import a concrete test suite`);
        assert.ok(!specifier.startsWith("../tasks/"), `${relative(file)} must not import a concrete test suite`);
        assert.ok(!specifier.startsWith("../workflow/"), `${relative(file)} must not import a concrete test suite`);
      }
    }
  });
});

async function listSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function importSpecifiers(text: string): string[] {
  return [...text.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^"']+\s+from\s+)?["']([^"']+)["']/g)]
    .map((match) => match[1] ?? "")
    .filter((specifier) => specifier.startsWith("."));
}

function resolveSourceImport(fromFile: string, specifier: string): string | null {
  if (!specifier.endsWith(".js")) {
    return null;
  }
  const resolved = path.normalize(path.join(path.dirname(fromFile), specifier.replace(/\.js$/, ".ts")));
  return resolved.startsWith(srcRoot) ? resolved : null;
}

function capabilityFor(file: string): string | null {
  const relativePath = relative(file);
  const parts = relativePath.split(path.sep);
  if (parts[0] !== "src") {
    return null;
  }
  if (parts.length === 2) {
    return null;
  }
  return capabilityDirs.has(parts[1] ?? "") ? parts[1] ?? null : null;
}

function relative(file: string): string {
  return path.relative(process.cwd(), file);
}
