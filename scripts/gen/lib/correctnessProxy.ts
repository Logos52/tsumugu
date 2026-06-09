/**
 * Round-trip correctness proxy for monolingual definitions (PRD §5.3 Stage 6 / §2 check 3b).
 * D2 ships the interface only — no LLM in the gen CLI.
 */

export type CorrectnessProxyStatus = "stub" | "recovered" | "missed" | "error";

export interface CorrectnessProxyResult {
  status: CorrectnessProxyStatus;
  /** Recovered headword when status is `recovered`. */
  recovered: string | null;
  /** Optional detail for human review queues. */
  detail?: string;
}

export interface CorrectnessProxyInput {
  gloss: string;
  illustration?: string;
  candidates: string[];
}

/** Contract for an external agent-run correctness check (not invoked by gen CLI). */
export interface CorrectnessProxy {
  recoverHeadword(input: CorrectnessProxyInput): Promise<CorrectnessProxyResult>;
}

/** Deterministic stub — always returns `stub`; wire a real proxy in agent batch runs. */
export const correctnessProxyStub: CorrectnessProxy = {
  async recoverHeadword(): Promise<CorrectnessProxyResult> {
    return {
      status: "stub",
      recovered: null,
      detail: "correctness proxy not run in gen CLI (D2 stub)",
    };
  },
};