import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MaterialUploader } from "@/components/MaterialUploader";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { DeleteClassButton } from "@/components/DeleteClassButton";
import { StudentEnrollment, type EnrolledStudent } from "@/components/StudentEnrollment";
import { AttendanceTaker } from "@/components/AttendanceTaker";
import { AssignmentManager } from "@/components/AssignmentManager";
import { DoubtsPanel } from "@/components/DoubtsPanel";
import { FeePanel, type FeeCycleRow } from "@/components/FeePanel";
import { QuestionBank, type QuestionRow } from "@/components/QuestionBank";
import { TestManager, type TestRow } from "@/components/TestManager";
import { Tabs, type Tab } from "@/components/ui/Tabs";
import { Panel } from "@/components/ui/Panel";

export default async function ClassDetailPage({
  params,
}: {
  params: { classId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: klass } = await supabase
    .from("classes")
    .select(
      "id, teacher_id, grade, classes_per_month, duration_minutes, monthly_fee, start_date, days_of_week, subjects(name)"
    )
    .eq("id", params.classId)
    .single();

  if (!klass) notFound();

  const subjectName = Array.isArray(klass.subjects)
    ? (klass.subjects[0] as { name: string } | undefined)?.name
    : (klass.subjects as unknown as { name: string } | null)?.name;

  const { data: materials } = await supabase
    .from("materials")
    .select("id, file_name, storage_path, file_type, created_at")
    .eq("class_id", klass.id)
    .order("created_at", { ascending: false });

  const { data: existingPlan } = await supabase
    .from("lesson_plans")
    .select("id, status")
    .eq("class_id", klass.id)
    .maybeSingle();

  const { data: enrolledRows } = await supabase
    .from("class_students")
    .select("student_id, students(grade, users(full_name))")
    .eq("class_id", klass.id);

  const enrolledStudents: EnrolledStudent[] = (enrolledRows ?? []).map((row) => {
    const studentRel = Array.isArray(row.students) ? row.students[0] : row.students;
    const userRel = studentRel
      ? Array.isArray((studentRel as { users: unknown }).users)
        ? ((studentRel as { users: { full_name: string }[] }).users)[0]
        : ((studentRel as unknown as { users: { full_name: string } | null }).users)
      : null;
    return {
      student_id: row.student_id,
      full_name: userRel?.full_name ?? "Student",
      grade: (studentRel as { grade?: string } | null)?.grade ?? "",
    };
  });

  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("id, title, instructions, due_date, max_marks")
    .eq("class_id", klass.id)
    .order("created_at", { ascending: false });

  const { data: submissionRows } = await supabase
    .from("assignment_submissions")
    .select("id, assignment_id, student_id, response_text, marks_awarded, teacher_comment, status, students(users(full_name))");

  function resolveName(rel: unknown): string {
    const studentRel = Array.isArray(rel) ? rel[0] : rel;
    if (!studentRel) return "Student";
    const usersRel = (studentRel as { users: unknown }).users;
    const userObj = Array.isArray(usersRel) ? usersRel[0] : usersRel;
    return (userObj as { full_name?: string } | null)?.full_name ?? "Student";
  }

  const assignments = (assignmentRows ?? []).map((a) => ({
    ...a,
    submissions: (submissionRows ?? [])
      .filter((s) => s.assignment_id === a.id)
      .map((s) => ({
        id: s.id,
        student_id: s.student_id,
        student_name: resolveName(s.students),
        response_text: s.response_text,
        marks_awarded: s.marks_awarded,
        teacher_comment: s.teacher_comment,
        status: s.status,
      })),
  }));

  const { data: doubtRows } = await supabase
    .from("doubts")
    .select("id, question, answer, status, created_at, students(users(full_name))")
    .eq("class_id", klass.id)
    .order("created_at", { ascending: false });

  const doubts = (doubtRows ?? []).map((d) => ({
    id: d.id,
    question: d.question,
    answer: d.answer,
    status: d.status,
    created_at: d.created_at,
    student_name: resolveName(d.students),
  }));

  const { data: feeCycleRows } = await supabase
    .from("fee_cycles")
    .select("id, period_label, classes_planned, classes_completed, amount, status, students(users(full_name))")
    .eq("class_id", klass.id)
    .order("period_label", { ascending: false });

  const feeCycles: FeeCycleRow[] = (feeCycleRows ?? []).map((f) => ({
    id: f.id,
    student_name: resolveName(f.students),
    period_label: f.period_label,
    classes_planned: f.classes_planned,
    classes_completed: f.classes_completed,
    amount: Number(f.amount),
    status: f.status,
  }));

  const { data: questionRows } = await supabase
    .from("questions")
    .select("id, question_type, question_text, options, correct_answer, marks")
    .eq("class_id", klass.id)
    .order("created_at", { ascending: false });

  const { data: testRows } = await supabase
    .from("tests")
    .select("id, title, time_limit_minutes, test_questions(question_id), test_attempts(score, status)")
    .eq("class_id", klass.id)
    .order("created_at", { ascending: false });

  const tests: TestRow[] = (testRows ?? []).map((t) => {
    const attempts = (Array.isArray(t.test_attempts) ? t.test_attempts : []) as {
      score: number | null;
      status: string;
    }[];
    const submitted = attempts.filter((a) => a.status === "submitted" && a.score !== null);
    const avg =
      submitted.length > 0
        ? Math.round(
            (submitted.reduce((s, a) => s + (a.score ?? 0), 0) / submitted.length) * 10
          ) / 10
        : null;
    return {
      id: t.id,
      title: t.title,
      time_limit_minutes: t.time_limit_minutes,
      question_count: Array.isArray(t.test_questions) ? t.test_questions.length : 0,
      attempt_count: attempts.length,
      avg_score: avg,
    };
  });

  const openDoubtCount = doubts.filter((d) => d.status !== "answered").length;
  const pendingGradeCount = assignments.reduce(
    (n, a) => n + a.submissions.filter((s) => s.marks_awarded === null).length,
    0
  );

  const tabs: Tab[] = [
    {
      id: "overview",
      label: "Overview",
      icon: "🏫",
      content: (
        <div className="space-y-6">
          <Panel
            title="Lesson Plan"
            description="LearnNest proposes a full month's plan from the syllabus — you review, edit, and accept it before it goes live."
          >
            {existingPlan ? (
              <div className="flex items-center gap-3">
                <Link
                  href={`/teacher/classes/${klass.id}/plan`}
                  className="rounded-xl bg-teacher px-4 py-2.5 font-medium text-white hover:opacity-90"
                >
                  {existingPlan.status === "accepted" ? "View Lesson Plan" : "Review Draft Plan"}
                </Link>
                <span className="text-sm text-ink/50">Status: {existingPlan.status}</span>
              </div>
            ) : (
              <GeneratePlanButton classId={klass.id} />
            )}
          </Panel>

          <Panel title="Teaching Materials" description="Upload the syllabus, textbook chapters, or notes for this class.">
            <MaterialUploader classId={klass.id} teacherId={klass.teacher_id} initialMaterials={materials ?? []} />
          </Panel>

          <div className="flex justify-end">
            <DeleteClassButton classId={klass.id} />
          </div>
        </div>
      ),
    },
    {
      id: "students",
      label: "Students",
      icon: "🧑‍🎓",
      content: (
        <div className="space-y-6">
          <Panel title="Students" description="Enroll students by the email they signed up with.">
            <StudentEnrollment classId={klass.id} initialStudents={enrolledStudents} />
          </Panel>
          <Panel
            title="Attendance"
            description="Pick a date and mark who attended. Everyone starts as present — just change the ones who weren't."
          >
            <AttendanceTaker classId={klass.id} hasStudents={enrolledStudents.length > 0} />
          </Panel>
        </div>
      ),
    },
    {
      id: "homework",
      label: "Homework",
      icon: "✏️",
      content: (
        <Panel title="Assignments & Homework" description="Set work for the class, then grade what students submit.">
          <AssignmentManager classId={klass.id} initialAssignments={assignments} />
        </Panel>
      ),
    },
    {
      id: "tests",
      label: "Tests",
      icon: "📝",
      content: (
        <div className="space-y-6">
          <Panel
            title="Question Bank"
            description="Questions here power both formal tests and students' practice/game mode."
          >
            <QuestionBank classId={klass.id} initialQuestions={(questionRows ?? []) as QuestionRow[]} />
          </Panel>
          <Panel title="Tests" description="Build a test from your question bank; scores are graded automatically.">
            <TestManager
              classId={klass.id}
              initialTests={tests}
              availableQuestions={(questionRows ?? []) as QuestionRow[]}
            />
          </Panel>
        </div>
      ),
    },
    {
      id: "doubts",
      label: "Questions",
      icon: "💬",
      content: (
        <Panel title="Student Questions" description="Questions students have asked you from their dashboard.">
          <DoubtsPanel initialDoubts={doubts} />
        </Panel>
      ),
    },
    {
      id: "fees",
      label: "Fees",
      icon: "💳",
      content: (
        <Panel
          title="Tuition Fees"
          description="Generate this month's fees. A cycle becomes due once the planned number of classes has been completed."
        >
          <FeePanel
            classId={klass.id}
            monthlyFee={klass.monthly_fee !== null ? Number(klass.monthly_fee) : null}
            initialCycles={feeCycles}
          />
        </Panel>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/teacher/classes" className="text-sm text-teacher underline">
        ← All classes
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-teacher">
            {klass.grade} · {subjectName ?? "Subject"}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Class Overview</h1>
        </div>
        <Link
          href={`/classroom/${klass.id}`}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          🎥 Start Live Class
        </Link>
      </div>
      <p className="mt-2 text-sm text-ink/50">
        {klass.classes_per_month} classes/month · {klass.duration_minutes} min each
        {klass.monthly_fee ? ` · ₹${klass.monthly_fee}/month` : ""}
        {klass.start_date ? ` · starts ${klass.start_date}` : ""}
        {klass.days_of_week?.length ? ` · ${klass.days_of_week.join(", ")}` : ""}
      </p>

      {(openDoubtCount > 0 || pendingGradeCount > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {openDoubtCount > 0 && (
            <span className="rounded-full bg-teacher-light px-3 py-1 text-xs font-semibold text-teacher">
              💬 {openDoubtCount} question{openDoubtCount === 1 ? "" : "s"} waiting
            </span>
          )}
          {pendingGradeCount > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              ✏️ {pendingGradeCount} to grade
            </span>
          )}
        </div>
      )}

      <div className="mt-6">
        <Tabs tabs={tabs} />
      </div>
    </main>
  );
}
