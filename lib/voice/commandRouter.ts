import type { MatchCandidate } from "./types";

// LearnNest — command routing logic (master prompt sections 4-5): given
// a spoken subject and a list of candidates (the student's own classes
// or tests, already fetched under RLS so this never sees anything the
// student isn't authorized to touch), decide whether to act directly or
// ask for clarification.
//
// Kept as pure functions with no React/Supabase/router dependencies so
// the resolution logic itself is easy to reason about — VoiceControl.tsx
// owns the state machine and side effects, this just decides "which
// one(s) match."

export type ResolutionResult =
  | { kind: "resolved"; candidate: MatchCandidate }
  | { kind: "clarify"; candidates: MatchCandidate[] }
  | { kind: "not_found" };

export function resolveEntityMatch(
  spokenSubject: string | undefined,
  candidates: MatchCandidate[]
): ResolutionResult {
  if (candidates.length === 0) {
    return { kind: "not_found" };
  }

  if (candidates.length === 1) {
    // Only one thing it could possibly be — act directly rather than
    // asking "which one?" for a list of one (spec section 4/5: "If only
    // one test matches, open it directly").
    return { kind: "resolved", candidate: candidates[0] };
  }

  if (spokenSubject) {
    const matches = candidates.filter((c) =>
      c.label.toLowerCase().includes(spokenSubject.toLowerCase())
    );
    if (matches.length === 1) return { kind: "resolved", candidate: matches[0] };
    if (matches.length > 1) return { kind: "clarify", candidates: matches };
  }

  // No subject spoken, or the subject didn't narrow it to one — ask.
  return { kind: "clarify", candidates };
}

/** Used to resolve a spoken clarification answer ("Science") against
 * the candidate list shown in the prompt. */
export function matchClarificationAnswer(
  transcript: string,
  candidates: MatchCandidate[]
): MatchCandidate | null {
  const lower = transcript.toLowerCase();
  return (
    candidates.find((c) => lower.includes(c.label.toLowerCase())) ?? null
  );
}
