// LearnNest — voice control types (master prompt: "Voice-Controlled
// Website" feature).
//
// This intent list matches section 3 of the spec, trimmed to what's
// actually wired up in this pass — see README for what's deferred.

export type VoiceIntent =
  | "NAVIGATE_HOME"
  | "OPEN_TESTS"
  | "START_TEST"
  | "OPEN_HOMEWORK"
  | "OPEN_STUDY_MATERIALS"
  | "OPEN_PROGRESS"
  | "OPEN_PRACTICE"
  | "JOIN_CLASS"
  | "GO_BACK"
  | "LOGOUT"
  | "HELP"
  | "UNKNOWN";

export type VoiceEntities = {
  subject?: string;
};

export type ParsedCommand = {
  intent: VoiceIntent;
  entities: VoiceEntities;
  rawTranscript: string;
};

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "clarifying"
  | "executing"
  | "success"
  | "error"
  | "unsupported";

export type MatchCandidate = {
  id: string;
  label: string; // e.g. subject name, used both for matching and for
  // the clarification prompt ("I found Maths and Science — which one?")
};
