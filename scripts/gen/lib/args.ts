/** Minimal argv parser: `--key value` pairs and `--flag` booleans. */
export interface ParsedArgs {
  _: string[];
  opts: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const _: string[] = [];
  const opts: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        opts[key] = true;
      } else {
        opts[key] = next;
        i++;
      }
    } else {
      _.push(a);
    }
  }
  return { _, opts };
}

export function str(opts: Record<string, string | boolean>, key: string): string | undefined {
  const v = opts[key];
  return typeof v === "string" ? v : undefined;
}

export function num(opts: Record<string, string | boolean>, key: string): number | undefined {
  const v = str(opts, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function list(opts: Record<string, string | boolean>, key: string): string[] {
  const v = str(opts, key);
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export function flag(opts: Record<string, string | boolean>, key: string): boolean {
  return opts[key] === true || opts[key] === "true";
}
