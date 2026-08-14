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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/teacher/classes" className="text-sm text-teacher underline">
        ← All classes
      </Link>

      <div className="mt-3">
        <p className="text-sm font-medium text-teacher">
          {klass.grade} · {subjectName ?? "Subject"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Class Overview</h1>
        <p className="mt-2 text-sm text-slate-500">
          {klass.classes_per_month} classes/month · {klass.duration_minutes} min
          each
          {klass.monthly_fee ? ` · ₹${klass.monthly_fee}/month` : ""}
          {klass.start_date ? ` · starts ${klass.start_date}` : ""}
          {klass.days_of_week?.length
            ? ` · ${klass.days_of_week.join(", ")}`
            : ""}
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-teacher-light bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Teaching Materials</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload the syllabus, textbook chapters, or notes for this class.
        </p>
        <div className="mt-4">
          <MaterialUploader
            classId={klass.id}
            teacherId={klass.teacher_id}
            initialMaterials={materials ?? []}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-teacher-light bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Lesson Plan</h2>
        <p className="mt-1 text-sm text-slate-500">
          LearnNest proposes a full month&apos;s plan from the syllabus —
          you review, edit, and accept it before it goes live.
        </p>
        <div className="mt-4">
          {existingPlan ? (
            <div className="flex items-center gap-3">
              <Link
                href={`/teacher/classes/${klass.id}/plan`}
                className="rounded-xl bg-teacher px-4 py-2.5 font-medium text-white hover:opacity-90"
              >
                {existingPlan.status === "accepted"
                  ? "View Lesson Plan"
                  : "Review Draft Plan"}
              </Link>
              <span className="text-sm text-slate-500">
                Status: {existingPlan.status}
              </span>
            </div>
          ) : (
            <GeneratePlanButton classId={klass.id} />
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-teacher-light bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Students</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enroll students by the email they signed up with.
        </p>
        <div className="mt-4">
          <StudentEnrollment
            classId={klass.id}
            initialStudents={enrolledStudents}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-teacher-light bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Attendance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick a date and mark who attended. Everyone starts as present —
          just change the ones who weren&apos;t.
        </p>
        <div className="mt-4">
          <AttendanceTaker
            classId={klass.id}
            hasStudents={enrolledStudents.length > 0}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-teacher-light bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Assignments &amp; Homework</h2>
        <p className="mt-1 text-sm text-slate-500">
          Set work for the class, then grade what students submit.
        </p>
        <div className="mt-4">
          <AssignmentManager classId={klass.id} initialAssignments={assignments} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-teacher-light bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Student Questions</h2>
        <p className="mt-1 text-sm text-slate-500">
          Questions students have asked you from their dashboard.
        </p>
        <div className="mt-4">
          <DoubtsPanel initialDoubts={doubts} />
        </div>
      </section>

      <div className="mt-6 flex justify-end">
        <DeleteClassButton classId={klass.id} />
      </div>
    </main>
  );
}
