import { mkdir, writeFile } from "node:fs/promises";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeFileIfMissing(filePath: string, content: string): Promise<boolean> {
  try {
    await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
