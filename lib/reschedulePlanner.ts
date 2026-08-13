// LearnNest — adaptive rescheduling engine (master prompt section 6)
//
// After each class, the teacher reports how much of the day's topic was
// completed. If it wasn't finished, this proposes a revised schedule —
// but NEVER applies it automatically. The teacher must explicitly accept,
// edit, or reject the proposal (see components/LessonPlanReview.tsx and
// the /api/schedule-proposals/[id]/resolve route).
//
// Current algorithm (deterministic, no AI call — same design principle
// as lib/lessonPlanner.ts): if a day finishes below the completion
// threshold, insert one "continuation" day right after it for the same
// topic, and shift every later day forward by one. This is intentionally
// simple for Stage 3 — section 47's fuller prioritization rules
// (prerequisites, exam-relevance, per-student performance) are a
// natural Stage 4 extension once test/assessment data exists to inform
// that prioritization.

export type PlanItemRow = {
  id: string;
  day_number: number;
  scheduled_date: string | null;
  topic_id: string | null;
  custom_title: string | null;
  title: string; // resolved display title (custom_title, or the topic's name)
  learning_objective: string | null;
  suggested_activities: string | null;
  estimated_minutes: number;
  is_revision: boolean;
  is_assessment: boolean;
};

export type ProposedItem = {
  day_number: number;
  scheduled_date: string | null;
  topic_id: string | null;
  custom_title: string | null;
  learning_objective: string | null;
  suggested_activities: string | null;
  estimated_minutes: number;
  is_revision: boolean;
  is_assessment: boolean;
};

export type RescheduleEvaluation =
  | { needsReschedule: false }
  | { needsReschedule: true; reason: string; proposedItems: ProposedItem[] };

const COMPLETION_THRESHOLD = 80; // below this, propose a continuation day

export function evaluateCompletion(
  allItems: PlanItemRow[],
  triggerItemId: string,
  completionPercentage: number
): RescheduleEvaluation {
  const trigger = allItems.find((i) => i.id === triggerItemId);
  if (!trigger) return { needsReschedule: false };

  if (completionPercentage >= COMPLETION_THRESHOLD) {
    return { needsReschedule: false };
  }

  const laterItems = allItems
    .filter((i) => i.day_number > trigger.day_number)
    .sort((a, b) => a.day_number - b.day_number);

  if (laterItems.length === 0) {
    // Nothing left to shift — the incomplete day was the last one.
    // A real product would roll this into next month; flagging that
    // here is enough for Stage 3 (see README known limitations).
    return { needsReschedule: false };
  }

  const continuationDay: ProposedItem = {
    day_number: trigger.day_number + 1,
    scheduled_date: null, // dates can't be safely auto-shifted; teacher sets manually
    topic_id: trigger.topic_id,
    custom_title: `Continued: ${trigger.title}`,
    learning_objective: trigger.learning_objective
      ? `Finish: ${trigger.learning_objective}`
      : `Continue and complete ${trigger.title}`,
    suggested_activities: "Pick up where the previous class left off; targeted practice on the remaining concepts.",
    estimated_minutes: trigger.estimated_minutes,
    is_revision: false,
    is_assessment: false,
  };

  const shiftedLaterItems: ProposedItem[] = laterItems.map((item) => ({
    day_number: item.day_number + 1,
    scheduled_date: null, // shifted — old date no longer applies, teacher re-sets
    topic_id: item.topic_id,
    custom_title: item.custom_title,
    learning_objective: item.learning_objective,
    suggested_activities: item.suggested_activities,
    estimated_minutes: item.estimated_minutes,
    is_revision: item.is_revision,
    is_assessment: item.is_assessment,
  }));

  return {
    needsReschedule: true,
    reason: `"${trigger.title}" was only ${completionPercentage}% complete, so a continuation day was added and the rest of the schedule shifted forward by one day.`,
    proposedItems: [continuationDay, ...shiftedLaterItems],
  };
}
