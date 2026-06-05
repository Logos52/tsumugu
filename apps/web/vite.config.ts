import { defineConfig, type Plugin } from "vite";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Dev-only vault bridge ────────────────────────────────────────────────────
// Local convenience for `pnpm dev`: serve the personal layer over HTTP so the
// app auto-loads the word store + discovers readings on page-load (no File
// System Access click) and persists grades back to disk. Dev-only —
// `configureServer` runs only in the dev server, never in the production
// client-side build. Override the root with TSUMUGU_VAULT; defaults to
// <repo>/personal (the store lives at vault/tsumugu/word-store.json under it).
const HERE = dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = process.env.TSUMUGU_VAULT
  ? resolve(process.env.TSUMUGU_VAULT)
  : resolve(HERE, "../../personal");
const PREFIX = "/@vault/";

/** Resolve a request path under the vault root, or null on traversal. */
function safeJoin(rel: string): string | null {
  const full = resolve(VAULT_ROOT, rel.replace(/^\/+/, ""));
  const r = relative(VAULT_ROOT, full);
  return r.startsWith("..") || isAbsolute(r) ? null : full;
}

/** All `*.prepared.json` readings under the vault, with lang/title if present. */
async function discoverReadings(): Promise<{ path: string; lang?: string; title?: string }[]> {
  const out: { path: string; lang?: string; title?: string }[] = [];
  async function walk(dir: string): Promise<void> {
    let ents;
    try {
      ents = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (e.name.endsWith(".prepared.json")) {
        try {
          const j = JSON.parse(await readFile(p, "utf8"));
          out.push({ path: relative(VAULT_ROOT, p), lang: j.lang, title: j.title });
        } catch {
          /* skip unparseable */
        }
      }
    }
  }
  await walk(VAULT_ROOT);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

function devVault(): Plugin {
  return {
    name: "tsumugu-dev-vault",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith(PREFIX)) return next();
        res.setHeader("x-tsumugu-vault", "1");
        const rel = decodeURIComponent(url.slice(PREFIX.length).split("?")[0] ?? "");
        if (rel === "__ping") {
          res.statusCode = 200;
          res.end("ok");
          return;
        }
        if (rel === "__readings") {
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.statusCode = 200;
          res.end(JSON.stringify(await discoverReadings()));
          return;
        }
        const full = safeJoin(rel);
        if (!full) {
          res.statusCode = 400;
          res.end("bad path");
          return;
        }
        try {
          if (req.method === "GET") {
            const text = await readFile(full, "utf8");
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.statusCode = 200;
            res.end(text);
            return;
          }
          if (req.method === "PUT" || req.method === "POST") {
            const chunks: Buffer[] = [];
            for await (const c of req) chunks.push(c as Buffer);
            await mkdir(dirname(full), { recursive: true });
            await writeFile(full, Buffer.concat(chunks));
            res.statusCode = 204;
            res.end();
            return;
          }
          res.statusCode = 405;
          res.end();
        } catch (e) {
          const code = (e as NodeJS.ErrnoException)?.code;
          res.statusCode = code === "ENOENT" ? 404 : 500;
          res.end(code === "ENOENT" ? "not found" : String((e as Error)?.message ?? e));
        }
      });
    },
  };
}

// Client-side only; no backend in the production build. The dev-vault plugin
// above exists only under `vite dev`. sql.js wasm is loaded via a ?url import.
export default defineConfig({
  root: ".",
  plugins: [devVault()],
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ["@tsumugu/engine", "@tsumugu/demo-pack"],
  },
});
