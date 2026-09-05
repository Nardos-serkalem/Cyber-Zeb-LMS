export type ResourceKind = 'Syllabus' | 'Lecture Notes' | 'Reading' | 'Video'

export type QuizPublishStatus = 'Draft' | 'Published' | 'Closed'

export type SubmissionStatus = 'Pending review' | 'Graded' | 'Late' | 'Not submitted'

export type EventType = 'Live class' | 'Exam' | 'Office hour' | 'Deadline'

export type AttendanceSessionStatus = 'scheduled' | 'completed' | 'cancelled'

export interface CourseResource {
  id: string
  title: string
  course: string
  kind: ResourceKind
  size: string
  updatedAt: string
  downloads: number
}

export interface InstructorQuiz {
  id: string
  title: string
  course: string
  dueAt: string
  questions: number
  duration: string
  status: QuizPublishStatus
  submissions: number
  enrolled: number
  avgScore?: string
}

export interface AssignmentSubmission {
  id: string
  title: string
  course: string
  dueAt: string
  brief: string
  pendingCount: number
  submittedCount: number
  enrolled: number
  status: SubmissionStatus
}

export interface ScheduleItem {
  id: string
  title: string
  course: string
  startAt: string
  type: EventType
  location: string
  accent: string
}

export interface GradebookEntry {
  id: string
  studentName: string
  courseCode: string
  course: string
  grade: string
  percent: number
  lastUpdated: string
  status: 'on-track' | 'at-risk' | 'excellent'
}

export interface TeachingCourse {
  id: string
  code: string
  title: string
  enrolledCount: number
  nextSession: string
  progress: number
  credits: number
  status: 'active' | 'completed' | 'upcoming'
  department: string
  pendingGrading: number
}

export interface LiveClassSession {
  id: string
  title: string
  course: string
  startAt: string
  duration: string
  platform: string
  meetingUrl?: string
  startUrl?: string
  status: 'live' | 'upcoming' | 'ended'
  attendees?: number
}

export interface AttendanceSession {
  id: string
  course: string
  date: string
  status: AttendanceSessionStatus
  presentCount: number
  enrolledCount: number
  absentCount: number
}

export interface AnnouncementItem {
  id: string
  title: string
  body: string
  postedAt: string
  priority: 'normal' | 'important'
  course?: string
  views: number
  authorName?: string
  isOwn?: boolean
}

export interface ForumThread {
  id: string
  title: string
  course: string
  author: string
  replies: number
  lastActivity: string
  pinned?: boolean
  needsModeration?: boolean
}

export interface StudentRosterItem {
  id: string
  name: string
  email: string
  course: string
  attendanceRate: number
  avgGrade: number
  status: 'active' | 'at-risk' | 'inactive'
  lastActive: string
}

export type InstructorCertStatus = 'issued' | 'pending' | 'eligible' | 'not-eligible'

export interface InstructorCertificateRow {
  /** Composite key: studentId + courseId */
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  courseId: string
  courseCode: string
  courseTitle: string
  /** 0–100 */
  completionPercent: number
  /** Formatted display string, e.g. "87%" or "—" */
  finalGrade: string
  completionDate?: string
  certStatus: InstructorCertStatus
  /** Populated when certStatus === 'issued' */
  certificateId?: string
  /** Populated when certStatus === 'issued' */
  issuedAt?: string
  /** Raw CertificateRecord id — used to pull full details */
  certRecordId?: string
  /** Populated for issued certs */
  institution?: string
}

export interface HelpDeskTicket {
  id: string
  subject: string
  category: string
  status: 'open' | 'in-review' | 'resolved'
  updatedAt: string
  priority: 'low' | 'medium' | 'high'
}

export interface TrendPoint {
  label: string
  value: number
}

export interface WorkloadOverviewItem {
  label: string
  count: number
  tone: 'success' | 'info' | 'warning' | 'danger'
}

export interface InstructorKpiTrends {
  classAvgScore: number[]
  submissionsGraded: number[]
  attendanceRate: number[]
  activeStudents: number[]
  forumEngagement: number[]
  sessionsHeld: number[]
}

export interface InstructorKpis {
  activeCourses: number
  totalStudents: number
  pendingGrading: number
  avgClassScore: number
  upcomingSessions: number
  ungradedSubmissions: number
  forumThreads: number
  officeHoursWeekly: number
}

export interface UpcomingTask {
  id: string
  title: string
  course: string
  dueIn: string
  status: 'upcoming' | 'today' | 'overdue'
  type: 'grading' | 'session' | 'announcement' | 'quiz'
}

export interface RecentActivityItem {
  id: string
  text: string
  timestamp: string
}

export interface InstructorDashboardData {
  instructorId: string
  instructorName: string
  email: string
  title: string
  department: string
  term: string
  officeHours: string
  specialization: string
  resources: CourseResource[]
  quizzes: InstructorQuiz[]
  assignments: AssignmentSubmission[]
  schedule: ScheduleItem[]
  gradebook: GradebookEntry[]
  courses: TeachingCourse[]
  liveClasses: LiveClassSession[]
  attendanceSessions: AttendanceSession[]
  announcements: AnnouncementItem[]
  forumThreads: ForumThread[]
  students: StudentRosterItem[]
  helpDeskTickets: HelpDeskTicket[]
  kpis: InstructorKpis
  kpiTrends: InstructorKpiTrends
  workloadOverview: WorkloadOverviewItem[]
  classScoreTrend: TrendPoint[]
  gradingTrend: TrendPoint[]
  attendanceTrend: TrendPoint[]
  engagementTrend: TrendPoint[]
  upcomingTasks: UpcomingTask[]
  recentActivity: RecentActivityItem[]
}
