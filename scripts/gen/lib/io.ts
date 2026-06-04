/**
 * Node-side IO for the generation CLI. This is a build-time script (not the
 * engine), so direct filesystem use is fine here.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readText(path)) as T;
}

export async function writeText(path: string, data: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data, "utf8");
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, JSON.stringify(value, null, 2) + "\n");
}

/** A filesystem-safe slug from a title/source (keeps CJK/Latin letters). */
export function slugify(s: string): string {
  const trimmed = s
    .trim()
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return trimmed || "untitled";
}
