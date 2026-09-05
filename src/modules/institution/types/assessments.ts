export type LiveSessionStatus = 'live' | 'upcoming' | 'ended' | 'cancelled'

export type AssessmentPublishStatus = 'draft' | 'published' | 'closed'

export type QuestionType = 'mcq' | 'true-false' | 'short-answer'

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export type StudentSubmissionStatus = 'not-submitted' | 'submitted' | 'graded' | 'late'

export interface LiveSessionRecord {
  id: string
  title: string
  courseId: string
  courseCode: string
  courseTitle: string
  instructorId: string
  instructorName: string
  campusId: string
  department: string
  startAt: string
  durationMinutes: number
  platform: string
  meetingUrl?: string
  startUrl?: string
  zoomMeetingId?: string
  zoomPassword?: string
  status: LiveSessionStatus
  attendees?: number
}

export interface AssignmentRecord {
  id: string
  title: string
  courseId: string
  courseCode: string
  courseTitle: string
  instructorId: string
  instructorName: string
  campusId: string
  department: string
  dueAt: string
  brief: string
  acceptedFormats: string[]
  status: AssessmentPublishStatus
  maxPoints: number
}

export interface QuizRecord {
  id: string
  title: string
  courseId: string
  courseCode: string
  courseTitle: string
  instructorId: string
  instructorName: string
  campusId: string
  department: string
  dueAt: string
  durationMinutes: number
  questionIds: string[]
  status: AssessmentPublishStatus
  maxPoints: number
}

export interface QuestionRecord {
  id: string
  stem: string
  type: QuestionType
  options?: string[]
  correctAnswer?: string
  tags: string[]
  courseId?: string
  courseCode?: string
  department: string
  difficulty: QuestionDifficulty
  points: number
  createdAt: string
}

export interface StudentSubmissionRecord {
  id: string
  studentId: string
  assessmentType: 'assignment' | 'quiz'
  assessmentId: string
  status: StudentSubmissionStatus
  score?: number
  maxScore?: number
  submittedAt?: string
  feedback?: string
  attachmentName?: string
}
