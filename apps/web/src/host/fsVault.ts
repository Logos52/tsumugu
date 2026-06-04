/**
 * Vault adapters implementing the engine's `VaultIO` port.
 *
 *  - `MemoryVault`  — a Map-backed in-memory vault, used as an offline fallback
 *    (no folder granted) and in tests.
 *  - `pickVaultFolder()` — prompts the user for a real folder via the File System
 *    Access API and returns a `VaultIO` backed by the granted directory handle.
 *
 * Both are framework-free and client-side: the only persistence is local files
 * the user explicitly grants. `pickVaultFolder` returns null where the API is
 * absent (non-Chromium browsers), so the host can fall back to `MemoryVault`.
 */

import type { VaultIO } from "@tsumugu/engine";

/** Normalize a "/"-separated path into non-empty segments. */
function segments(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

/**
 * In-memory `VaultIO`. Files live in a flat `Map` keyed by their normalized
 * "/"-joined path; directories are implied by the keys present.
 */
export class MemoryVault implements VaultIO {
  private readonly files = new Map<string, string>();

  private key(path: string): string {
    return segments(path).join("/");
  }

  async readText(path: string): Promise<string | null> {
    const v = this.files.get(this.key(path));
    return v === undefined ? null : v;
  }

  async writeText(path: string, data: string): Promise<void> {
    this.files.set(this.key(path), data);
  }

  /** Immediate child entry names of a directory (non-recursive). */
  async list(dir: string): Promise<string[]> {
    const prefix = segments(dir);
    const children = new Set<string>();
    for (const key of this.files.keys()) {
      const parts = key.split("/");
      if (parts.length <= prefix.length) continue;
      let matches = true;
      for (let i = 0; i < prefix.length; i++) {
        if (parts[i] !== prefix[i]) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
      const child = parts[prefix.length];
      if (child !== undefined) children.add(child);
    }
    return [...children];
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(this.key(path));
  }
}

// ── File System Access API adapter ──────────────────────────────────────────
//
// The DOM lib types for the File System Access API are not present in every
// TS DOM lib version, so we declare the minimal surface we use. We never use
// `any`; these mirror the WHATWG spec shapes.

interface FsWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface FsFileHandle {
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<FsWritable>;
}

interface FsDirectoryHandle {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FsDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FsFileHandle>;
  values(): AsyncIterableIterator<{ name: string; kind: "file" | "directory" }>;
}

interface DirectoryPickerWindow {
  showDirectoryPicker(options?: {
    mode?: "read" | "readwrite";
  }): Promise<FsDirectoryHandle>;
}

/** Whether an error names a missing entry (NotFoundError). */
function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: unknown }).name === "NotFoundError"
  );
}

/**
 * Resolve all-but-last segments to a directory handle. With `create`, missing
 * directories are made; otherwise a missing directory throws NotFoundError.
 */
async function resolveDir(
  root: FsDirectoryHandle,
  parts: string[],
  create: boolean,
): Promise<FsDirectoryHandle> {
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const name = parts[i];
    if (name === undefined) continue;
    dir = await dir.getDirectoryHandle(name, { create });
  }
  return dir;
}

/** Build a `VaultIO` backed by a granted `FileSystemDirectoryHandle`. */
function vaultFromHandle(root: FsDirectoryHandle): VaultIO {
  return {
    async readText(path: string): Promise<string | null> {
      const parts = segments(path);
      const fileName = parts[parts.length - 1];
      if (fileName === undefined) return null;
      try {
        const dir = await resolveDir(root, parts, false);
        const handle = await dir.getFileHandle(fileName);
        const file = await handle.getFile();
        return await file.text();
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },

    async writeText(path: string, data: string): Promise<void> {
      const parts = segments(path);
      const fileName = parts[parts.length - 1];
      if (fileName === undefined) {
        throw new Error(`Invalid vault path: ${path}`);
      }
      const dir = await resolveDir(root, parts, true);
      const handle = await dir.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
    },

    async list(dir: string): Promise<string[]> {
      const parts = segments(dir);
      // For listing, every part is a directory (no trailing file segment).
      let handle = root;
      try {
        for (const name of parts) {
          handle = await handle.getDirectoryHandle(name);
        }
      } catch (err) {
        if (isNotFound(err)) return [];
        throw err;
      }
      const names: string[] = [];
      for await (const entry of handle.values()) {
        names.push(entry.name);
      }
      return names;
    },

    async exists(path: string): Promise<boolean> {
      const parts = segments(path);
      const fileName = parts[parts.length - 1];
      if (fileName === undefined) return false;
      try {
        const parent = await resolveDir(root, parts, false);
        await parent.getFileHandle(fileName);
        return true;
      } catch (err) {
        if (isNotFound(err)) {
          // Might be a directory rather than a file.
          try {
            let handle = root;
            for (const name of parts) {
              handle = await handle.getDirectoryHandle(name);
            }
            return true;
          } catch (dirErr) {
            if (isNotFound(dirErr)) return false;
            throw dirErr;
          }
        }
        throw err;
      }
    },
  };
}

/**
 * Prompt the user to grant a vault folder. Returns null where the File System
 * Access API is unavailable (the host falls back to `MemoryVault`), or if the
 * user dismisses the picker.
 */
export async function pickVaultFolder(): Promise<VaultIO | null> {
  if (!("showDirectoryPicker" in window)) return null;
  try {
    const win = window as unknown as DirectoryPickerWindow;
    const handle = await win.showDirectoryPicker({ mode: "readwrite" });
    return vaultFromHandle(handle);
  } catch {
    // AbortError (user cancelled) or permission denial → no vault.
    return null;
  }
}
