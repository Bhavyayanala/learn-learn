"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { performSignOut } from "@/lib/auth/signOut";
import { isVoiceSupported, listenOnce } from "@/lib/voice/speechRecognition";
import { speak } from "@/lib/voice/speechSynthesis";
import { parseCommand } from "@/lib/voice/intentParser";
import { resolveEntityMatch, matchClarificationAnswer } from "@/lib/voice/commandRouter";
import type { VoiceState, MatchCandidate } from "@/lib/voice/types";

const HELP_EXAMPLES = [
  "Join my Maths class",
  "Start today's test",
  "Open my homework",
  "Show my progress",
  "Open practice",
  "Go home",
  "Go back",
];

// Dashboard sections a voice command can jump straight to — matching
// element ids added to app/student/dashboard/page.tsx.
const DASHBOARD_SECTION_IDS: Record<string, string> = {
  OPEN_TESTS: "voice-tests-section",
  OPEN_HOMEWORK: "voice-homework-section",
  OPEN_STUDY_MATERIALS: "voice-materials-section",
};

type Pending =
  | { kind: "clarify_class"; candidates: MatchCandidate[] }
  | { kind: "clarify_test"; candidates: MatchCandidate[] }
  | { kind: "confirm_logout" };

export function VoiceControl() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [supported, setSupported] = useState(true);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const stopRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setSupported(isVoiceSupported());
  }, []);

  function reset() {
    setState("idle");
    setTranscript("");
    setPending(null);
  }

  function say(text: string) {
    setMessage(text);
    speak(text);
  }

  async function scrollToSection(intent: string) {
    const targetId = DASHBOARD_SECTION_IDS[intent];
    if (!targetId) return;

    if (pathname !== "/student/dashboard") {
      router.push(`/student/dashboard#${targetId}`);
      return;
    }
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function fetchClassCandidates(): Promise<MatchCandidate[]> {
    const { data } = await supabase
      .from("class_students")
      .select("class_id, classes(id, subjects(name))");
    return (data ?? [])
      .map((row) => {
        const klass = Array.isArray(row.classes) ? row.classes[0] : row.classes;
        const subj = klass
          ? Array.isArray((klass as { subjects: unknown }).subjects)
            ? (klass as { subjects: { name: string }[] }).subjects[0]
            : (klass as unknown as { subjects: { name: string } | null }).subjects
          : null;
        return { id: row.class_id, label: subj?.name ?? "Class" };
      })
      .filter((c) => c.id);
  }

  async function fetchTestCandidates(): Promise<MatchCandidate[]> {
    const { data: enrolments } = await supabase.from("class_students").select("class_id");
    const classIds = (enrolments ?? []).map((e) => e.class_id);
    if (classIds.length === 0) return [];

    const { data } = await supabase
      .from("tests")
      .select("id, title, classes(subjects(name))")
      .in("class_id", classIds);

    return (data ?? []).map((t) => {
      const klass = Array.isArray(t.classes) ? t.classes[0] : t.classes;
      const subj = klass
        ? Array.isArray((klass as { subjects: unknown }).subjects)
          ? (klass as { subjects: { name: string }[] }).subjects[0]
          : (klass as unknown as { subjects: { name: string } | null }).subjects
        : null;
      return { id: t.id, label: subj?.name ? `${subj.name} — ${t.title}` : t.title };
    });
  }

  async function handleClarificationAnswer(raw: string) {
    if (!pending) return;

    if (pending.kind === "confirm_logout") {
      const yes = /\byes\b|\byeah\b|\bsure\b|\bconfirm\b/i.test(raw);
      if (yes) {
        setState("executing");
        await performSignOut();
        say("Signing you out.");
        router.push("/login");
        setState("success");
      } else {
        say("Okay, staying signed in.");
        setState("success");
      }
      setTimeout(reset, 1500);
      return;
    }

    const candidates = pending.candidates;
    const match = matchClarificationAnswer(raw, candidates);
    if (!match) {
      say("Sorry, I didn't catch which one. Let's try again.");
      setState("error");
      setTimeout(reset, 1800);
      return;
    }

    setState("executing");
    if (pending.kind === "clarify_class") {
      say(`Joining ${match.label}.`);
      router.push(`/classroom/${match.id}`);
    } else {
      say(`Opening the ${match.label} test.`);
      router.push(`/student/tests/${match.id}`);
    }
    setState("success");
    setTimeout(reset, 1500);
  }

  async function handleTranscript(raw: string) {
    setTranscript(raw);
    setState("processing");

    if (pending) {
      await handleClarificationAnswer(raw);
      return;
    }

    // Only fetch enrolled subjects when needed for entity extraction —
    // keeps a plain "go home" fast with no network round trip.
    const needsSubjects = /join|test|class/i.test(raw);
    const knownSubjects = needsSubjects
      ? Array.from(
          new Set((await fetchClassCandidates()).map((c) => c.label))
        )
      : [];

    const command = parseCommand(raw, knownSubjects);

    switch (command.intent) {
      case "NAVIGATE_HOME":
        say("Going to your dashboard.");
        router.push("/student/dashboard");
        setState("success");
        break;

      case "GO_BACK":
        say("Going back.");
        router.back();
        setState("success");
        break;

      case "HELP":
        say("You can say things like: join my maths class, or open my homework.");
        setState("success");
        break;

      case "LOGOUT":
        setPending({ kind: "confirm_logout" });
        say("Are you sure you want to sign out?");
        setState("clarifying");
        return; // wait for the next utterance, don't auto-reset

      case "OPEN_PRACTICE":
        say("Opening practice.");
        router.push("/student/practice");
        setState("success");
        break;

      case "OPEN_TESTS":
      case "OPEN_HOMEWORK":
      case "OPEN_STUDY_MATERIALS":
        say(`Opening ${command.intent === "OPEN_TESTS" ? "your tests" : command.intent === "OPEN_HOMEWORK" ? "your homework" : "your study materials"}.`);
        await scrollToSection(command.intent);
        setState("success");
        break;

      case "OPEN_PROGRESS":
        say("Opening your progress.");
        router.push("/student/progress");
        setState("success");
        break;

      case "JOIN_CLASS": {
        const candidates = await fetchClassCandidates();
        const result = resolveEntityMatch(command.entities.subject, candidates);
        if (result.kind === "not_found") {
          say("You're not enrolled in any class yet.");
          setState("error");
        } else if (result.kind === "resolved") {
          say(`Joining ${result.candidate.label}.`);
          router.push(`/classroom/${result.candidate.id}`);
          setState("success");
        } else {
          const names = result.candidates.map((c) => c.label).join(" and ");
          say(`I found ${names} classes. Which one would you like to join?`);
          setPending({ kind: "clarify_class", candidates: result.candidates });
          setState("clarifying");
          return;
        }
        break;
      }

      case "START_TEST": {
        const candidates = await fetchTestCandidates();
        const result = resolveEntityMatch(command.entities.subject, candidates);
        if (result.kind === "not_found") {
          say("I couldn't find any tests for you right now.");
          setState("error");
        } else if (result.kind === "resolved") {
          say(`Opening the ${result.candidate.label} test.`);
          router.push(`/student/tests/${result.candidate.id}`);
          setState("success");
        } else {
          const names = result.candidates.map((c) => c.label).join(" and ");
          say(`I found two tests: ${names}. Which one should I open?`);
          setPending({ kind: "clarify_test", candidates: result.candidates });
          setState("clarifying");
          return;
        }
        break;
      }

      default:
        say("Sorry, I didn't understand that. Try saying 'Open my homework.'");
        setState("error");
    }

    setTimeout(reset, 1800);
  }

  function startListening() {
    if (!supported) return;
    setOpen(true);
    setMessage("");
    setTranscript("");
    setState("listening");

    stopRef.current = listenOnce(
      (result) => handleTranscript(result),
      (error) => {
        if (error === "not-allowed") {
          say("Microphone access is needed for voice control. Please allow microphone access in your browser settings.");
        } else if (error === "no-speech") {
          say("I didn't hear anything. Try again?");
        } else if (error === "unsupported") {
          say("Voice control isn't supported in this browser yet.");
        } else {
          say("Sorry, something went wrong. Let's try again.");
        }
        setState("error");
        setTimeout(reset, 2000);
      },
      () => {
        // onend fires after result/error too — only matters if neither
        // fired (e.g. silence timeout without an explicit error).
      }
    );
  }

  if (!supported) return null; // graceful degradation, per spec section 18/21

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 w-72 rounded-2xl border-2 border-student bg-white p-4 shadow-lift">
          <p className="text-xs font-bold text-student">🎤 Voice Control</p>

          {state === "listening" && (
            <p className="mt-2 text-center text-sm text-slate-500">🔴 Listening…</p>
          )}
          {state === "processing" && (
            <p className="mt-2 text-center text-sm text-slate-500">Thinking…</p>
          )}
          {transcript && (
            <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm italic text-slate-600">
              &ldquo;{transcript}&rdquo;
            </p>
          )}
          {message && (
            <p
              className={`mt-2 text-sm font-medium ${
                state === "error" ? "text-red-600" : "text-emerald-700"
              }`}
            >
              {message}
            </p>
          )}
          {state === "clarifying" && pending?.kind !== "confirm_logout" && (
            <p className="mt-2 text-xs text-slate-400">Tap the mic and say your answer.</p>
          )}
          {state === "idle" && !message && (
            <div className="mt-2 text-xs text-slate-400">
              <p className="font-medium text-slate-500">Try saying:</p>
              <ul className="mt-1 space-y-0.5">
                {HELP_EXAMPLES.slice(0, 3).map((ex) => (
                  <li key={ex}>&ldquo;{ex}&rdquo;</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={startListening}
              disabled={state === "listening" || state === "processing" || state === "executing"}
              className="flex-1 rounded-xl bg-student px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              🎤 {pending ? "Answer" : "Speak"}
            </button>
            <button
              onClick={() => {
                stopRef.current?.stop();
                setOpen(false);
                reset();
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => (open ? startListening() : (setOpen(true), startListening()))}
        className={`grid h-14 w-14 place-items-center rounded-full text-2xl text-white shadow-lift transition-transform hover:scale-105 ${
          state === "listening" ? "animate-pulse bg-red-500" : "bg-student"
        }`}
        aria-label="Voice control"
      >
        🎤
      </button>
    </div>
  );
}
