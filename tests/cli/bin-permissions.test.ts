import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

describe("published bin entries", () => {
  it("builds executable CLI entry files", async () => {
    await access(path.join(process.cwd(), "dist/src/cli.js"), constants.X_OK);
    await access(path.join(process.cwd(), "dist/src/agent-command.js"), constants.X_OK);
  });
});
