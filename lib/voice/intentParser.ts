import type { ParsedCommand, VoiceIntent } from "./types";

// LearnNest — voice intent parser (master prompt section 9).
//
// Deliberately NOT exact string matching ("if command === 'join maths
// class'") — each intent is a set of trigger phrases/keywords checked
// against the transcript with .includes(), so "please join my maths
// class" and "can you take me to maths class" both resolve the same
// way. This is the "lightweight keyword system, structured so an LLM
// can be added later" the spec explicitly calls for when no LLM is
// already wired into the app (this project doesn't have one configured
// — see .env.example's ANTHROPIC_API_KEY placeholder, unset).
//
// To swap in a real LLM later: replace the body of parseCommand with a
// call to a /api/voice/parse route that prompts a model to return the
// same { intent, entities } shape — nothing else in the voice pipeline
// needs to change, since CommandRouter only depends on this function's
// return type, not its implementation.

type Rule = { intent: VoiceIntent; patterns: RegExp[] };

// Order matters: more specific patterns (START_TEST, JOIN_CLASS) are
// checked before their more general counterparts (OPEN_TESTS) so
// "start today's maths test" doesn't get caught by a generic "test"
// keyword rule first.
const RULES: Rule[] = [
  {
    intent: "GO_BACK",
    patterns: [/\bgo back\b/, /\bprevious page\b/, /\bback\b.*\bpage\b/],
  },
  {
    intent: "HELP",
    patterns: [/\bhelp\b/, /what can i say/, /what can you do/],
  },
  {
    intent: "LOGOUT",
    patterns: [/\blog\s?out\b/, /\bsign\s?out\b/, /\bexit\b/],
  },
  {
    intent: "NAVIGATE_HOME",
    patterns: [/\bgo home\b/, /\bhome\s?page\b/, /\bmy dashboard\b/, /\bdashboard\b/],
  },
  {
    intent: "START_TEST",
    patterns: [/\bstart\b.*\btest\b/, /\btake\b.*\btest\b/, /\bopen\b.*\btest\b/, /\bgive me.*test\b/],
  },
  {
    intent: "OPEN_TESTS",
    patterns: [/\bmy tests\b/, /\bshow.*tests\b/, /\btests\b/],
  },
  {
    intent: "JOIN_CLASS",
    patterns: [/\bjoin\b/, /\btake me to\b.*\bclass\b/, /\benter\b.*\bclass\b/, /\bstart\b.*\bclass\b/, /\bopen\b.*\bclass\b/],
  },
  {
    intent: "OPEN_PRACTICE",
    patterns: [/\bpractice\b/, /\bplay\b/, /\bgames?\b/],
  },
  {
    intent: "OPEN_HOMEWORK",
    patterns: [/\bhomework\b/, /\bassignments?\b/],
  },
  {
    intent: "OPEN_STUDY_MATERIALS",
    patterns: [/\bstudy materials?\b/, /\bmaterials?\b/, /\bnotes\b/],
  },
  {
    intent: "OPEN_PROGRESS",
    patterns: [/\bprogress\b/, /\bmy badges\b/, /\bxp\b/, /\bhow.*am i doing\b/],
  },
];

// Recognized subject names — pulled dynamically from the student's own
// enrolled classes at call time (see CommandRouter), this list is only
// a fallback set of common spoken variants per section 8, mapped onto
// whatever subject names actually exist in the `subjects` table.
const SUBJECT_ALIASES: Record<string, string[]> = {
  Mathematics: ["math", "maths", "mathematics"],
  Science: ["science"],
  English: ["english"],
};

export function extractSubject(transcript: string, knownSubjects: string[]): string | undefined {
  const lower = transcript.toLowerCase();

  // First try exact/partial matches against the student's real subject
  // names (handles subjects beyond the three seeded ones).
  for (const subject of knownSubjects) {
    if (lower.includes(subject.toLowerCase())) return subject;
  }

  // Then common spoken aliases ("maths" -> "Mathematics").
  for (const [canonical, aliases] of Object.entries(SUBJECT_ALIASES)) {
    if (!knownSubjects.includes(canonical)) continue;
    if (aliases.some((a) => lower.includes(a))) return canonical;
  }

  return undefined;
}

export function parseCommand(transcript: string, knownSubjects: string[]): ParsedCommand {
  const lower = transcript.toLowerCase().trim();

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(lower))) {
      return {
        intent: rule.intent,
        entities: { subject: extractSubject(lower, knownSubjects) },
        rawTranscript: transcript,
      };
    }
  }

  return { intent: "UNKNOWN", entities: {}, rawTranscript: transcript };
}
