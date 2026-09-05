import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import { getActiveTenant } from '../../../shared/config/tenant'
import { formatCurrency } from '../../../shared/storage/platformUtils'
import type { ReportsAnalytics } from '../../../shared/storage/reportsAnalytics'
import { downloadBlob, downloadTextFile } from '../../../shared/utils/downloadFile'
import type { GeneratedReport } from '../types'

const NAVY: [number, number, number] = [27, 35, 64]
const LEMON: [number, number, number] = [168, 212, 0]
const MUTED = '#64748B'

export function reportFileStem(report: Pick<GeneratedReport, 'name' | 'category'>): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const safe = `${report.category}-${report.name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `berana-${safe || 'report'}-${stamp}`
}

function institutionName(): string {
  return getActiveTenant()?.name?.trim() || 'Berana LMS'
}

function kpiRows(analytics: ReportsAnalytics, category: string): [string, string][] {
  const { summary } = analytics
  const academic: [string, string][] = [
    ['Active learners', String(summary.activeStudents)],
    ['Total students', String(summary.totalStudents)],
    ['Active enrollments', String(summary.activeEnrollments)],
    ['Average completion', `${summary.avgCompletion}%`],
    ['Published courses', String(summary.publishedCourses)],
    ['Open assignments', String(summary.openAssignments)],
    ['Open quizzes', String(summary.openQuizzes)],
  ]
  const attendance: [string, string][] = [
    ['Average attendance', `${summary.avgAttendance}%`],
    ['Active learners', String(summary.activeStudents)],
    ['Upcoming live sessions', String(summary.upcomingSessions)],
    ['Learners at risk', String(analytics.atRiskLearners.length)],
  ]
  const financial: [string, string][] = [
    ['Revenue collected', formatCurrency(summary.revenueCollected)],
    ['Outstanding', formatCurrency(summary.revenueOutstanding)],
    ['Overdue invoices', String(summary.overduePayments)],
  ]
  const engagement: [string, string][] = [
    ['Active learners', String(summary.activeStudents)],
    ['Average completion', `${summary.avgCompletion}%`],
    ['Open assignments', String(summary.openAssignments)],
    ['Open quizzes', String(summary.openQuizzes)],
    ['Upcoming live sessions', String(summary.upcomingSessions)],
  ]

  switch (category) {
    case 'Attendance':
      return attendance
    case 'Financial':
      return financial
    case 'Engagement':
    case 'Instructor Activity':
      return engagement
    case 'Compliance & Audit':
      return [...attendance, ...financial.slice(0, 2)]
    default:
      return [...academic, ...attendance.slice(0, 2), ...financial]
  }
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function buildCsv(report: GeneratedReport, analytics: ReportsAnalytics): string {
  const lines: string[][] = [
    ['Institution', institutionName()],
    ['Report', report.name],
    ['Category', report.category],
    ['Generated', new Date().toLocaleString()],
    [],
    ['Metric', 'Value'],
    ...kpiRows(analytics, report.category),
    [],
    ['Top courses'],
    ['Code', 'Title', 'Instructor', 'Enrolled', 'Progress %'],
    ...analytics.topCourses.map((course) => [
      course.code,
      course.title,
      course.instructor,
      String(course.enrolled),
      String(course.completion),
    ]),
    [],
    ['Department performance'],
    ['Department', 'Students', 'Enrollments', 'Completion %', 'Attendance %'],
    ...analytics.departmentStats.map((dept) => [
      dept.name,
      String(dept.students),
      String(dept.enrollments),
      String(dept.avgCompletion),
      String(dept.avgAttendance),
    ]),
  ]

  if (analytics.atRiskLearners.length > 0) {
    lines.push(
      [],
      ['Learners at risk'],
      ['Student', 'Course', 'Attendance %', 'Progress %'],
      ...analytics.atRiskLearners.map((learner) => [
        learner.name,
        learner.course,
        String(learner.attendance),
        String(learner.progress),
      ]),
    )
  }

  return lines.map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n')
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text(title, 14, y)
  return y + 4
}

function buildPdf(report: GeneratedReport, analytics: ReportsAnalytics): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const generated = new Date().toLocaleString()

  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setFillColor(...LEMON)
  doc.rect(0, 28, pageWidth, 1.6, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Berana LMS', 14, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(institutionName(), 14, 18)
  doc.setFontSize(8)
  doc.text(generated, pageWidth - 14, 12, { align: 'right' })
  doc.text(report.category, pageWidth - 14, 18, { align: 'right' })

  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(report.name, 14, 40)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text('Generated from live institution data in Berana.', 14, 46)

  autoTable(doc, {
    startY: 52,
    theme: 'grid',
    head: [['Metric', 'Value']],
    body: kpiRows(analytics, report.category),
    styles: { fontSize: 9, cellPadding: 2.4, textColor: NAVY },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [238, 240, 247] },
    columnStyles: { 0: { cellWidth: 90 }, 1: { fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  })

  let y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 52) + 12

  const includeCourses =
    report.category !== 'Financial' && report.category !== 'Attendance'
  const includeDepartments = report.category !== 'Financial'
  const includeRisk = !['Financial', 'Engagement', 'Instructor Activity'].includes(report.category)

  if (includeCourses && analytics.topCourses.length > 0) {
    y = addSectionTitle(doc, 'Top courses by enrollment', y)
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Code', 'Course', 'Instructor', 'Enrolled', 'Progress']],
      body: analytics.topCourses.map((course) => [
        course.code,
        course.title,
        course.instructor,
        String(course.enrolled),
        `${course.completion}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 2, textColor: NAVY },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [238, 240, 247] },
      margin: { left: 14, right: 14 },
    })
    y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 12
  }

  if (includeDepartments && analytics.departmentStats.length > 0) {
    y = addSectionTitle(doc, 'Department performance', y)
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Department', 'Students', 'Enrollments', 'Completion', 'Attendance']],
      body: analytics.departmentStats.map((dept) => [
        dept.name,
        String(dept.students),
        String(dept.enrollments),
        `${dept.avgCompletion}%`,
        `${dept.avgAttendance}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 2, textColor: NAVY },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [238, 240, 247] },
      margin: { left: 14, right: 14 },
    })
    y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 12
  }

  if (includeRisk && analytics.atRiskLearners.length > 0) {
    addSectionTitle(doc, 'Learners at risk', y)
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Student', 'Course', 'Attendance', 'Progress']],
      body: analytics.atRiskLearners.map((learner) => [
        learner.name,
        learner.course,
        `${learner.attendance}%`,
        `${learner.progress}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 2, textColor: NAVY },
      headStyles: { fillColor: [229, 57, 53], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 235, 238] },
      margin: { left: 14, right: 14 },
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    doc.text(
      `Confidential · ${institutionName()} · Page ${page} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    )
  }

  return doc
}

export async function downloadInstitutionReport(
  report: GeneratedReport,
  analytics: ReportsAnalytics,
): Promise<void> {
  const stem = reportFileStem(report)

  if (report.format === 'PDF') {
    const doc = buildPdf(report, analytics)
    const blob = doc.output('blob')
    downloadBlob(`${stem}.pdf`, blob)
    return
  }

  const csv = buildCsv(report, analytics)
  downloadTextFile(`${stem}.csv`, csv, 'text/csv;charset=utf-8')
}
