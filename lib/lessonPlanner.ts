// LearnNest — automatic lesson planner
//
// Turns (subject, grade, classes/month, duration) into a proposed
// day-by-day teaching plan, per master-prompt sections 3–4.
//
// This is a deterministic, rule-based engine — no AI call, no external
// cost, fully explainable. Section 58/59 of the spec calls for exactly
// this: keep the AI layer optional and separate, use deterministic logic
// wherever it's sufficient. If an AI material-analysis step is added in
// a later stage, it should populate/extend the `topics` table — this
// planner doesn't need to change.
//
// The teacher always reviews and can edit/accept the result (section 49)
// — this function only produces a *draft*.

export type Topic = {
  id: string;
  sequence_order: number;
  name: string;
  learning_objective: string;
  suggested_activities: string | null;
  is_foundational: boolean;
};

export type PlanItemDraft = {
  day_number: number;
  scheduled_date: string | null; // ISO date, or null if no start date given
  topic_id: string | null;
  custom_title: string | null;
  learning_objective: string | null;
  suggested_activities: string | null;
  estimated_minutes: number;
  is_revision: boolean;
  is_assessment: boolean;
};

export type GeneratePlanInput = {
  classesPerMonth: number;
  durationMinutes: number;
  startDate: string | null; // ISO date
  daysOfWeek: string[]; // e.g. ["Mon", "Wed", "Fri"]
  topics: Topic[]; // already filtered to the right subject + grade
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Decide how many of the available class slots should be reserved for
 * revision / assessment at the end of the month, based on section 48
 * ("reserve time for revision, practice, mock test").
 */
function reservedDayCount(classesPerMonth: number): 0 | 1 | 2 {
  if (classesPerMonth >= 8) return 2; // separate revision day + assessment day
  if (classesPerMonth >= 4) return 1; // combined revision+assessment day
  return 0; // too few classes to spare a dedicated day
}

/**
 * Walks forward from startDate, returning the next `count` dates that
 * fall on one of the given weekdays. If daysOfWeek is empty, just
 * returns consecutive days. Returns an array of nulls if no startDate.
 */
function computeScheduledDates(
  startDate: string | null,
  daysOfWeek: string[],
  count: number
): (string | null)[] {
  if (!startDate) return new Array(count).fill(null);

  const wanted = daysOfWeek.length
    ? new Set(daysOfWeek.map((d) => WEEKDAY_INDEX[d]).filter((n) => n !== undefined))
    : null;

  const dates: string[] = [];
  const cursor = new Date(startDate + "T00:00:00");

  // Safety cap so a bad input can't loop forever.
  for (let guard = 0; guard < 3650 && dates.length < count; guard++) {
    const dow = cursor.getDay();
    if (!wanted || wanted.has(dow)) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function generateLessonPlan(input: GeneratePlanInput): PlanItemDraft[] {
  const { classesPerMonth, durationMinutes, startDate, daysOfWeek, topics } = input;

  const orderedTopics = [...topics]
    .filter((t) => !/revision/i.test(t.name)) // we schedule revision ourselves
    .sort((a, b) => a.sequence_order - b.sequence_order);

  const reserved = reservedDayCount(classesPerMonth);
  const teachingDays = Math.max(classesPerMonth - reserved, 1);

  const selected = orderedTopics.slice(0, teachingDays);

  // If the syllabus has fewer topics than available teaching days, use
  // the remaining days for extra practice on topics already covered
  // rather than leaving them empty — foundational topics get priority
  // for the repeat practice slots (section 47: prioritize prerequisites).
  const paddingNeeded = teachingDays - selected.length;
  const foundational = orderedTopics.filter((t) => t.is_foundational);
  const paddingTopics: (Topic | null)[] = [];
  for (let i = 0; i < paddingNeeded; i++) {
    paddingTopics.push(foundational[i % Math.max(foundational.length, 1)] ?? null);
  }

  const dates = computeScheduledDates(startDate, daysOfWeek, classesPerMonth);

  const items: PlanItemDraft[] = [];
  let day = 1;

  for (const topic of selected) {
    items.push({
      day_number: day,
      scheduled_date: dates[day - 1] ?? null,
      topic_id: topic.id,
      custom_title: null,
      learning_objective: topic.learning_objective,
      suggested_activities: topic.suggested_activities,
      estimated_minutes: durationMinutes,
      is_revision: false,
      is_assessment: false,
    });
    day++;
  }

  for (const topic of paddingTopics) {
    items.push({
      day_number: day,
      scheduled_date: dates[day - 1] ?? null,
      topic_id: topic?.id ?? null,
      custom_title: topic ? `Practice: ${topic.name}` : "Practice & Consolidation",
      learning_objective: topic
        ? `Reinforce: ${topic.learning_objective}`
        : "Reinforce topics covered so far",
      suggested_activities: "Extra practice worksheet, quick recap quiz",
      estimated_minutes: durationMinutes,
      is_revision: false,
      is_assessment: false,
    });
    day++;
  }

  if (reserved === 2) {
    items.push({
      day_number: day,
      scheduled_date: dates[day - 1] ?? null,
      topic_id: null,
      custom_title: "Revision",
      learning_objective: "Consolidate this month's topics before assessment",
      suggested_activities: "Full recap of all topics, Q&A, mixed practice set",
      estimated_minutes: durationMinutes,
      is_revision: true,
      is_assessment: false,
    });
    day++;
    items.push({
      day_number: day,
      scheduled_date: dates[day - 1] ?? null,
      topic_id: null,
      custom_title: "Monthly Assessment",
      learning_objective: "Assess understanding of this month's topics",
      suggested_activities: "Monthly test covering all topics taught",
      estimated_minutes: durationMinutes,
      is_revision: false,
      is_assessment: true,
    });
    day++;
  } else if (reserved === 1) {
    items.push({
      day_number: day,
      scheduled_date: dates[day - 1] ?? null,
      topic_id: null,
      custom_title: "Revision + Assessment",
      learning_objective: "Consolidate and assess this month's topics",
      suggested_activities: "Recap + short monthly test",
      estimated_minutes: durationMinutes,
      is_revision: true,
      is_assessment: true,
    });
    day++;
  }

  return items;
}
