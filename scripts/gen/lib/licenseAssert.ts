/**
 * Build-time license assertion for monolingual zh generation inputs (PRD §6.2).
 * Hard-fails when a BY-SA / BY-ND source is used as a *generation seed*.
 */

export type GenerationSeedLicense =
  | "cc0"
  | "cc-by"
  | "mit"
  | "apache-2.0"
  | "public-domain"
  | "authored"
  | "cc-by-sa"
  | "cc-by-nd"
  | "gfdl"
  | "unknown";

export type ProvenanceRole = "generation-seed" | "reference-only";

export interface ProvenanceSource {
  id: string;
  license: GenerationSeedLicense;
  role: ProvenanceRole;
  /** Optional excerpt checked for known contamination markers. */
  text?: string;
}

export interface ProvenanceManifest {
  sources: ProvenanceSource[];
}

export interface LicenseAssertResult {
  ok: boolean;
  /** Hard-fail reasons (BY-SA/BY-ND seeds, etc.). */
  errors: string[];
  /** Non-blocking notes (reference-only BY-SA sources, etc.). */
  notes: string[];
}

const FORBIDDEN_SEED_LICENSES = new Set<GenerationSeedLicense>([
  "cc-by-sa",
  "cc-by-nd",
  "gfdl",
]);

/** Known markers that indicate MoEDict / MoE dictionary text in a seed. */
const MOEDICT_MARKERS = [
  "教育部國語小字典",
  "MoEDict",
  "萌典",
  "dict.mini.moe.edu.tw",
  "國語小字典",
] as const;

/**
 * Assert every monolingual-generation input against the allow-list.
 * BY-SA / BY-ND sources used as generation seeds → hard-fail.
 */
export function assertMonolingualSeedLicenses(
  manifest: ProvenanceManifest,
): LicenseAssertResult {
  const errors: string[] = [];
  const notes: string[] = [];

  for (const src of manifest.sources) {
    if (src.role === "generation-seed" && FORBIDDEN_SEED_LICENSES.has(src.license)) {
      errors.push(
        `${src.id}: license "${src.license}" is forbidden as a monolingual generation seed (PRD §7 R-2)`,
      );
    }
    if (src.role === "reference-only" && FORBIDDEN_SEED_LICENSES.has(src.license)) {
      notes.push(`${src.id}: ${src.license} recorded as reference-only (not a seed)`);
    }
    if (src.text !== undefined && src.role === "generation-seed") {
      for (const marker of MOEDICT_MARKERS) {
        if (src.text.includes(marker)) {
          errors.push(
            `${src.id}: MoEDict/MoE dictionary text detected in generation seed ("${marker}") — CC BY-ND`,
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, notes };
}

/** First PRD fixture: MoEDict BY-ND used as a generation seed → hard-fail. */
export function moedictByNdSeedFixture(): ProvenanceManifest {
  return {
    sources: [
      {
        id: "moe-mini-dict",
        license: "cc-by-nd",
        role: "generation-seed",
        text: "教育部國語小字典：形容詞，表示人多、吵鬧、有活力的樣子。",
      },
    ],
  };
}