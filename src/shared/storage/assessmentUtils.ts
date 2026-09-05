import type { AssignmentItem, LiveClassSession, QuizItem } from '../../modules/students/types'
import type {
  AssignmentSubmission,
  InstructorQuiz,
  LiveClassSession as InstructorLiveClass,
} from '../../modules/instructors/types'
import type {
  AssignmentRecord,
  LiveSessionRecord,
  QuizRecord,
  StudentSubmissionRecord,
} from '../../modules/institution/types/assessments'
import type { AssignmentSubmission as AdminAssignmentSubmission } from '../../modules/institution/types'
import type { DeadlineItem, UpcomingClassItem } from '../../modules/institution/types'
import type { UpcomingDeadline } from '../../modules/students/types'
import type { UpcomingTask } from '../../modules/instructors/types'
import { readEnrollments, readPeople } from './readers'

export function formatAssessmentDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

export function resolveLiveSessionStatus(
  session: LiveSessionRecord,
): 'live' | 'upcoming' | 'ended' {
  if (session.status === 'cancelled' || session.status === 'ended') return 'ended'

  const now = Date.now()
  const start = new Date(session.startAt).getTime()
  const end = start + session.durationMinutes * 60 * 1000

  if (now >= start && now <= end) return 'live'
  if (now < start) return 'upcoming'
  return 'ended'
}

function getEnrolledCourseIds(studentId: string): Set<string> {
  return new Set(
    readEnrollments()
      .filter((e) => e.studentId === studentId && e.status === 'active')
      .map((e) => e.courseId),
  )
}

function countEnrolledInCourse(courseId: string): number {
  return readEnrollments().filter(
    (e) => e.courseId === courseId && e.status === 'active',
  ).length
}

function findSubmission(
  submissions: StudentSubmissionRecord[],
  studentId: string,
  assessmentType: 'assignment' | 'quiz',
  assessmentId: string,
): StudentSubmissionRecord | undefined {
  return submissions.find(
    (s) =>
      s.studentId === studentId &&
      s.assessmentType === assessmentType &&
      s.assessmentId === assessmentId,
  )
}

function dueInLabel(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `Due in ${diffDays} days`
}

function deadlineStatus(iso: string): 'upcoming' | 'today' | 'overdue' {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  return 'upcoming'
}

export function toStudentLiveClasses(
  sessions: LiveSessionRecord[],
  studentId: string,
): LiveClassSession[] {
  const courseIds = getEnrolledCourseIds(studentId)

  return sessions
    .filter((s) => courseIds.has(s.courseId) && s.status !== 'cancelled')
    .map((s) => ({
      id: s.id,
      title: s.title,
      course: s.courseCode,
      instructor: s.instructorName,
      startAt: formatAssessmentDateTime(s.startAt),
      duration: formatDurationMinutes(s.durationMinutes),
      platform: s.platform,
      meetingUrl: s.meetingUrl,
      status: resolveLiveSessionStatus(s),
    }))
    .sort((a, b) => {
      const order = { live: 0, upcoming: 1, ended: 2 }
      return order[a.status] - order[b.status]
    })
}

export function toInstructorLiveClasses(
  sessions: LiveSessionRecord[],
  instructorId: string,
  instructorName: string,
): InstructorLiveClass[] {
  return sessions
    .filter(
      (s) =>
        s.instructorId === instructorId ||
        s.instructorName === instructorName,
    )
    .filter((s) => s.status !== 'cancelled')
    .map((s) => ({
      id: s.id,
      title: s.title,
      course: s.courseCode,
      startAt: formatAssessmentDateTime(s.startAt),
      duration: formatDurationMinutes(s.durationMinutes),
      platform: s.platform,
      meetingUrl: s.meetingUrl,
      startUrl: s.startUrl,
      status: resolveLiveSessionStatus(s),
      attendees: s.attendees,
    }))
    .sort((a, b) => {
      const order = { live: 0, upcoming: 1, ended: 2 }
      return order[a.status] - order[b.status]
    })
}

export function toStudentQuizzes(
  quizzes: QuizRecord[],
  submissions: StudentSubmissionRecord[],
  studentId: string,
): QuizItem[] {
  const courseIds = getEnrolledCourseIds(studentId)
  const now = Date.now()

  return quizzes
    .filter((q) => courseIds.has(q.courseId) && q.status === 'published')
    .map((q) => {
      const submission = findSubmission(submissions, studentId, 'quiz', q.id)
      const pastDue = new Date(q.dueAt).getTime() < now

      let status: QuizItem['status'] = 'Open'
      let score: string | undefined

      if (submission?.status === 'graded' && submission.score !== undefined) {
        status = 'Completed'
        score = `${Math.round((submission.score / (submission.maxScore ?? q.maxPoints)) * 100)}%`
      } else if (submission?.status === 'submitted') {
        status = 'Completed'
      } else if (pastDue) {
        status = 'Locked'
      }

      return {
        id: q.id,
        title: q.title,
        course: q.courseCode,
        dueAt: formatAssessmentDateTime(q.dueAt),
        questions: q.questionIds.length,
        duration: formatDurationMinutes(q.durationMinutes),
        status,
        score,
      }
    })
}

export function toInstructorQuizzes(
  quizzes: QuizRecord[],
  submissions: StudentSubmissionRecord[],
  instructorId: string,
  instructorName: string,
): InstructorQuiz[] {
  return quizzes
    .filter(
      (q) =>
        q.instructorId === instructorId || q.instructorName === instructorName,
    )
    .map((q) => {
      const quizSubs = submissions.filter(
        (s) => s.assessmentType === 'quiz' && s.assessmentId === q.id,
      )
      const graded = quizSubs.filter((s) => s.status === 'graded')
      const avgScore =
        graded.length > 0
          ? `${Math.round(
              graded.reduce(
                (sum, s) =>
                  sum + ((s.score ?? 0) / (s.maxScore ?? q.maxPoints)) * 100,
                0,
              ) / graded.length,
            )}%`
          : undefined

      const statusMap: Record<QuizRecord['status'], InstructorQuiz['status']> = {
        draft: 'Draft',
        published: 'Published',
        closed: 'Closed',
      }

      return {
        id: q.id,
        title: q.title,
        course: q.courseCode,
        dueAt: formatAssessmentDateTime(q.dueAt),
        questions: q.questionIds.length,
        duration: formatDurationMinutes(q.durationMinutes),
        status: statusMap[q.status],
        submissions: quizSubs.filter((s) => s.status !== 'not-submitted').length,
        enrolled: countEnrolledInCourse(q.courseId),
        avgScore,
      }
    })
}

export function toStudentAssignments(
  assignments: AssignmentRecord[],
  submissions: StudentSubmissionRecord[],
  studentId: string,
): AssignmentItem[] {
  const courseIds = getEnrolledCourseIds(studentId)

  return assignments
    .filter((a) => courseIds.has(a.courseId) && a.status === 'published')
    .map((a) => {
      const submission = findSubmission(submissions, studentId, 'assignment', a.id)

      let status: AssignmentItem['status'] = 'Ready to submit'
      let feedback: string | undefined

      if (submission?.status === 'graded') {
        status = 'Graded'
        feedback = submission.feedback
      } else if (submission?.status === 'submitted' || submission?.status === 'late') {
        status = 'Submitted'
      }

      return {
        id: a.id,
        title: a.title,
        course: a.courseCode,
        dueAt: formatAssessmentDateTime(a.dueAt),
        brief: a.brief,
        acceptedFormats: a.acceptedFormats,
        status,
        feedback,
      }
    })
}

export function toInstructorAssignments(
  assignments: AssignmentRecord[],
  submissions: StudentSubmissionRecord[],
  instructorId: string,
  instructorName: string,
): AssignmentSubmission[] {
  return assignments
    .filter(
      (a) =>
        a.instructorId === instructorId || a.instructorName === instructorName,
    )
    .map((a) => {
      const asgSubs = submissions.filter(
        (s) => s.assessmentType === 'assignment' && s.assessmentId === a.id,
      )
      const pending = asgSubs.filter(
        (s) => s.status === 'submitted' || s.status === 'late',
      ).length
      const graded = asgSubs.filter((s) => s.status === 'graded').length
      const enrolled = countEnrolledInCourse(a.courseId)

      let status: AssignmentSubmission['status'] = 'Not submitted'
      if (pending > 0) status = 'Pending review'
      else if (graded > 0) status = 'Graded'

      return {
        id: a.id,
        title: a.title,
        course: a.courseCode,
        dueAt: formatAssessmentDateTime(a.dueAt),
        brief: a.brief,
        pendingCount: pending,
        submittedCount: asgSubs.filter((s) => s.status !== 'not-submitted').length,
        enrolled,
        status,
      }
    })
}

export function toAdminAssignmentSubmissions(
  assignments: AssignmentRecord[],
  submissions: StudentSubmissionRecord[],
): AdminAssignmentSubmission[] {
  const people = readPeople()

  return submissions
    .filter((s) => s.assessmentType === 'assignment' && s.status !== 'not-submitted')
    .map((s) => {
      const assignment = assignments.find((a) => a.id === s.assessmentId)
      const student = people.find((p) => p.id === s.studentId)

      const statusMap: Record<
        StudentSubmissionRecord['status'],
        AdminAssignmentSubmission['status']
      > = {
        'not-submitted': 'pending',
        submitted: 'submitted',
        late: 'late',
        graded: 'graded',
      }

      return {
        id: s.id,
        assignment: assignment?.title ?? 'Unknown assignment',
        course: assignment?.courseCode ?? '—',
        student: student?.name ?? s.studentId,
        submittedAt: s.submittedAt
          ? formatAssessmentDateTime(s.submittedAt)
          : '—',
        status: statusMap[s.status],
      }
    })
}

export function toUpcomingLiveClasses(
  sessions: LiveSessionRecord[],
): UpcomingClassItem[] {
  return sessions
    .filter((s) => resolveLiveSessionStatus(s) === 'upcoming')
    .slice(0, 5)
    .map((s) => {
      const date = new Date(s.startAt)
      return {
        id: s.id,
        title: s.title,
        course: s.courseCode,
        instructor: s.instructorName,
        date: date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        time: date.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        }),
      }
    })
}

export function toUpcomingDeadlines(
  assignments: AssignmentRecord[],
  quizzes: QuizRecord[],
): DeadlineItem[] {
  const items: DeadlineItem[] = [
    ...assignments
      .filter((a) => a.status === 'published')
      .map((a) => ({
        id: a.id,
        title: a.title,
        course: a.courseCode,
        dueIn: dueInLabel(a.dueAt),
        status: deadlineStatus(a.dueAt),
      })),
    ...quizzes
      .filter((q) => q.status === 'published')
      .map((q) => ({
        id: q.id,
        title: q.title,
        course: q.courseCode,
        dueIn: dueInLabel(q.dueAt),
        status: deadlineStatus(q.dueAt),
      })),
  ]

  return items
    .sort((a, b) => {
      const order = { today: 0, upcoming: 1, overdue: 2 }
      return order[a.status] - order[b.status]
    })
    .slice(0, 8)
}

export function toStudentUpcomingDeadlines(
  assignments: AssignmentRecord[],
  quizzes: QuizRecord[],
  submissions: StudentSubmissionRecord[],
  studentId: string,
): UpcomingDeadline[] {
  const courseIds = getEnrolledCourseIds(studentId)

  const items: UpcomingDeadline[] = []

  for (const a of assignments) {
    if (!courseIds.has(a.courseId) || a.status !== 'published') continue
    const sub = findSubmission(submissions, studentId, 'assignment', a.id)
    if (sub && sub.status !== 'not-submitted') continue
    items.push({
      id: a.id,
      title: a.title,
      course: a.courseCode,
      dueIn: dueInLabel(a.dueAt),
      status: deadlineStatus(a.dueAt),
    })
  }

  for (const q of quizzes) {
    if (!courseIds.has(q.courseId) || q.status !== 'published') continue
    const sub = findSubmission(submissions, studentId, 'quiz', q.id)
    if (sub && sub.status !== 'not-submitted') continue
    items.push({
      id: q.id,
      title: q.title,
      course: q.courseCode,
      dueIn: dueInLabel(q.dueAt),
      status: deadlineStatus(q.dueAt),
    })
  }

  return items.sort((a, b) => {
    const order = { today: 0, upcoming: 1, overdue: 2 }
    return order[a.status] - order[b.status]
  })
}

export function toInstructorUpcomingTasks(
  assignments: AssignmentRecord[],
  quizzes: QuizRecord[],
  sessions: LiveSessionRecord[],
  instructorId: string,
  instructorName: string,
): UpcomingTask[] {
  const tasks: UpcomingTask[] = []

  for (const s of sessions) {
    if (
      s.instructorId !== instructorId &&
      s.instructorName !== instructorName
    ) {
      continue
    }
    if (resolveLiveSessionStatus(s) !== 'upcoming') continue
    tasks.push({
      id: s.id,
      title: s.title,
      course: s.courseCode,
      dueIn: formatAssessmentDateTime(s.startAt),
      status: 'upcoming',
      type: 'session',
    })
  }

  for (const q of quizzes) {
    if (q.instructorId !== instructorId && q.instructorName !== instructorName) {
      continue
    }
    if (q.status !== 'published') continue
    tasks.push({
      id: q.id,
      title: q.title,
      course: q.courseCode,
      dueIn: dueInLabel(q.dueAt),
      status: deadlineStatus(q.dueAt),
      type: 'quiz',
    })
  }

  for (const a of assignments) {
    if (a.instructorId !== instructorId && a.instructorName !== instructorName) {
      continue
    }
    if (a.status !== 'published') continue
    tasks.push({
      id: a.id,
      title: a.title,
      course: a.courseCode,
      dueIn: dueInLabel(a.dueAt),
      status: deadlineStatus(a.dueAt),
      type: 'grading',
    })
  }

  return tasks.slice(0, 6)
}

export function countUpcomingLiveSessions(sessions: LiveSessionRecord[]): number {
  return sessions.filter((s) => resolveLiveSessionStatus(s) === 'upcoming').length
}

export function computeStudentAssessmentStats(
  quizzes: QuizItem[],
  assignments: AssignmentItem[],
  liveClasses: LiveClassSession[],
) {
  const completedQuizzes = quizzes.filter((q) => q.status === 'Completed')
  const scores = completedQuizzes
    .filter((q) => q.score)
    .map((q) => parseInt(q.score ?? '0', 10))
  const avgQuizScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0

  const submittedAssignments = assignments.filter(
    (a) => a.status === 'Submitted' || a.status === 'Graded',
  ).length

  return {
    avgQuizScore,
    assignmentsCompleted: submittedAssignments,
    dueThisWeek:
      quizzes.filter((q) => q.status === 'Open').length +
      assignments.filter((a) => a.status === 'Ready to submit').length,
    upcomingSessions: liveClasses.filter((s) => s.status === 'upcoming').length,
  }
}
