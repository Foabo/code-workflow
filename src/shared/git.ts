import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitStatus =
  | { kind: "clean" }
  | { kind: "dirty"; entries: string[] }
  | { kind: "not-git-repository" };

export async function getGitStatus(root: string): Promise<GitStatus> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: root });
    const entries = stdout.split(/\r?\n/).filter(Boolean);
    return entries.length === 0 ? { kind: "clean" } : { kind: "dirty", entries };
  } catch {
    return { kind: "not-git-repository" };
  }
}
