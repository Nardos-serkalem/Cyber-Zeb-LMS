import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FileText,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { StatBlock } from '../../../shared/components/StatBlock'
import { Button } from '../../../shared/components/Button'
import { PageHeader } from '../../../shared/components/PageHeader'
import { Modal } from '../../../shared/components/Modal'
import { FormField } from '../../../shared/components/FormField'
import { FilterTabs } from '../../../shared/components/FilterTabs'
import { StatusPill } from '../../../shared/components/StatusPill'
import { useToast } from '../../../shared/components/toast/ToastProvider'
import { useApiCollection } from '../../../shared/hooks/useApiCollection'
import { createId } from '../../../shared/hooks/useLocalStorageState'
import { GlassCard } from '../../../shared/layout/GlassCard'
import { STORAGE_KEYS } from '../../../shared/storage/keys'
import { buildReportsAnalytics } from '../../../shared/storage/reportsAnalytics'
import { formatCurrency } from '../../../shared/storage/platformUtils'
import { ReportCategoryCard } from '../components/ReportCategoryCard'
import { GeneratedReportsList } from '../components/GeneratedReportsList'
import { MiniBarChart } from '../components/MiniBarChart'
import { TrendLineChart } from '../components/TrendLineChart'
import { downloadInstitutionReport } from '../utils/exportInstitutionReport'
import type { GeneratedReport, ReportCategory } from '../types'

const STAT = 17

const categories: ReportCategory[] = [
  { id: 'r1', title: 'Academic Performance', description: 'Grades, GPA distribution, progression and transcripts.', icon: '🎓', reportCount: 12 },
  { id: 'r2', title: 'Attendance', description: 'Class and session attendance, absences and risk alerts.', icon: '📅', reportCount: 8 },
  { id: 'r3', title: 'Financial', description: 'Invoices, payments, refunds and revenue reconciliation.', icon: '💳', reportCount: 10 },
  { id: 'r4', title: 'Engagement', description: 'Logins, activity, course completion and content usage.', icon: '📈', reportCount: 9 },
  { id: 'r5', title: 'Compliance & Audit', description: 'Access logs, policy acknowledgment and audit trails.', icon: '🛡️', reportCount: 6 },
  { id: 'r6', title: 'Instructor Activity', description: 'Teaching load, grading turnaround and responsiveness.', icon: '🧑‍🏫', reportCount: 7 },
]

const categoryOptions = categories.map((c) => c.title)
const formatOptions: GeneratedReport['format'][] = ['PDF', 'Excel', 'CSV']
const analyticsTabs = ['Overview', 'Academic', 'Financial', 'Engagement']

const emptyForm = {
  name: '',
  category: categoryOptions[0],
  format: 'PDF' as GeneratedReport['format'],
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ReportsPage() {
  const { notify } = useToast()
  const analytics = useMemo(() => buildReportsAnalytics(), [])
  const [reports, setReports] = useApiCollection<GeneratedReport[]>(STORAGE_KEYS.reports, [])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [activeTab, setActiveTab] = useState('Overview')
  const [generating, setGenerating] = useState(false)

  const openModal = () => {
    setForm(emptyForm)
    setModalOpen(true)
  }

  const handleGenerate = async () => {
    if (!form.name.trim()) {
      notify('Please give the report a name.', 'error')
      return
    }

    const newReport: GeneratedReport = {
      id: createId('report'),
      name: form.name.trim(),
      category: form.category,
      generatedOn: todayLabel(),
      format: form.format,
      status: 'ready',
    }

    setGenerating(true)
    try {
      await downloadInstitutionReport(newReport, analytics)
      setReports((prev) => [newReport, ...prev])
      setModalOpen(false)
      setForm(emptyForm)
      notify(`"${newReport.name}" downloaded as ${newReport.format}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not generate the report.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (report: GeneratedReport) => {
    try {
      await downloadInstitutionReport(report, analytics)
      notify(`Downloaded "${report.name}".`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not download the report.', 'error')
    }
  }

  const reportList = Array.isArray(reports) ? reports : []
  const readyCount = reportList.filter((r) => r.status === 'ready').length
  const { summary } = analytics

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Real-time institution insights, trends, and exportable reports."
        actions={
          <>
            <Button variant="secondary" onClick={() => notify('Scheduled delivery unlocks with the backend.', 'info')}>
              <CalendarClock size={15} />
              Schedule
            </Button>
            <Button variant="primary" onClick={openModal}>
              <Plus size={16} />
              New Report
            </Button>
          </>
        }
      />

      <FilterTabs tabs={analyticsTabs} active={activeTab} onChange={setActiveTab} />

      {(activeTab === 'Overview' || activeTab === 'Academic') ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <StatBlock label="Active learners" value={summary.activeStudents} sub={`${summary.totalStudents} total`} icon={<Users size={STAT} />} />
            <StatBlock label="Enrollments" value={summary.activeEnrollments} sub="Active links" icon={<BookOpen size={STAT} />} />
            <StatBlock label="Avg. completion" value={`${summary.avgCompletion}%`} sub="Across courses" icon={<CheckCircle2 size={STAT} />} />
            <StatBlock label="Avg. attendance" value={`${summary.avgAttendance}%`} sub="Session average" icon={<TrendingUp size={STAT} />} />
            <StatBlock label="Published courses" value={summary.publishedCourses} sub="In catalog" icon={<BarChart3 size={STAT} />} />
            <StatBlock label="Reports ready" value={readyCount} sub="Generated exports" icon={<FileText size={STAT} />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <MiniBarChart title="Enrollment growth" subtitle="Active learners — last 6 months" data={analytics.enrollmentTrend} />
            <MiniBarChart title="Completion by department" subtitle="Average progress %" data={analytics.completionByDepartment} unit="%" />
            <MiniBarChart title="Attendance by department" subtitle="Session attendance %" data={analytics.attendanceByDepartment} unit="%" />
          </div>
        </>
      ) : null}

      {(activeTab === 'Overview' || activeTab === 'Financial') ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBlock label="Revenue collected" value={formatCurrency(summary.revenueCollected)} sub="Paid invoices" icon={<Wallet size={STAT} />} iconBg="bg-success-bg text-success" />
          <StatBlock label="Outstanding" value={formatCurrency(summary.revenueOutstanding)} sub="Unpaid balance" icon={<Wallet size={STAT} />} iconBg="bg-warning-bg text-warning" />
          <StatBlock label="Overdue invoices" value={summary.overduePayments} sub="Past due date" icon={<AlertTriangle size={STAT} />} iconBg="bg-danger-bg text-danger" />
          <StatBlock label="Live sessions" value={summary.upcomingSessions} sub="Upcoming this week" icon={<CalendarClock size={STAT} />} />
        </div>
      ) : null}

      {(activeTab === 'Overview' || activeTab === 'Financial' || activeTab === 'Engagement') ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeTab === 'Overview' || activeTab === 'Financial' ? (
            <TrendLineChart
              title="Revenue trend"
              subtitle="Collected payments (ETB thousands) — last 6 months"
              data={analytics.revenueTrend}
              color="#16A34A"
              unit="k"
            />
          ) : null}
          {activeTab === 'Overview' || activeTab === 'Engagement' ? (
            <TrendLineChart
              title="Assessment activity"
              subtitle="Published assignments & quizzes — last 6 months"
              data={analytics.assessmentActivity}
              color="#1976D2"
            />
          ) : null}
          {activeTab === 'Overview' || activeTab === 'Engagement' ? (
            <TrendLineChart
              title="Portal logins"
              subtitle="Estimated weekly active sessions — last 6 months"
              data={analytics.loginActivity}
              color="#A8D400"
            />
          ) : null}
        </div>
      ) : null}

      {(activeTab === 'Overview' || activeTab === 'Academic') ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <GlassCard className="p-5">
            <h3 className="text-[15px] font-extrabold text-navy-900 mb-4">Top courses by enrollment</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead>
                  <tr className="border-b border-divider text-[11px] uppercase tracking-wider text-secondary-text">
                    <th className="py-2 pr-3">Course</th>
                    <th className="py-2 pr-3">Instructor</th>
                    <th className="py-2 pr-3">Enrolled</th>
                    <th className="py-2">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topCourses.map((course) => (
                    <tr key={course.id} className="border-b border-divider/50">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-navy-900">{course.code}</div>
                        <div className="text-[11px] text-secondary-text truncate max-w-[180px]">{course.title}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-secondary-text">{course.instructor}</td>
                      <td className="py-2.5 pr-3">{course.enrolled}</td>
                      <td className="py-2.5">{course.completion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-[15px] font-extrabold text-navy-900 mb-4">Department performance</h3>
            <div className="flex flex-col gap-3">
              {analytics.departmentStats.map((dept) => (
                <div key={dept.name} className="rounded-xl border border-divider p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="font-semibold text-navy-900 text-[13px]">{dept.name}</div>
                    <div className="text-[11px] text-secondary-text mt-0.5">{dept.students} students · {dept.enrollments} enrollments</div>
                  </div>
                  <div className="flex gap-3 text-[12px]">
                    <span><strong>{dept.avgCompletion}%</strong> completion</span>
                    <span><strong>{dept.avgAttendance}%</strong> attendance</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}

      {(activeTab === 'Overview' || activeTab === 'Academic') && analytics.atRiskLearners.length > 0 ? (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-warning" />
            <h3 className="text-[15px] font-extrabold text-navy-900">Learners at risk</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-divider text-[11px] uppercase tracking-wider text-secondary-text">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Course</th>
                  <th className="py-2 pr-4">Attendance</th>
                  <th className="py-2 pr-4">Progress</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.atRiskLearners.map((learner) => (
                  <tr key={learner.id} className="border-b border-divider/50">
                    <td className="py-2.5 pr-4 font-semibold">{learner.name}</td>
                    <td className="py-2.5 pr-4">{learner.course}</td>
                    <td className="py-2.5 pr-4">{learner.attendance}%</td>
                    <td className="py-2.5 pr-4">{learner.progress}%</td>
                    <td className="py-2.5">
                      <StatusPill label="at-risk" tone="danger" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}

      <div>
        <h2 className="text-[15px] font-extrabold text-navy-900 mb-4">Report categories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
          {categories.map((category) => (
            <ReportCategoryCard
              key={category.id}
              category={category}
              onOpen={(c) => {
                setForm({ ...emptyForm, category: c.title, name: `${c.title} Report` })
                setModalOpen(true)
              }}
            />
          ))}
        </div>
      </div>

      <GeneratedReportsList reports={reportList} onDownload={(report) => void handleDownload(report)} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        icon={<FileText size={18} />}
        title="New Report"
        description="Generate a report from your institution data."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleGenerate()} disabled={generating}>
              {generating ? 'Creating file…' : 'Generate & download'}
            </Button>
          </>
        }
      >
        <FormField label="Report Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Fall Semester Grade Distribution" />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Category" type="select" value={form.category} options={categoryOptions} onChange={(v) => setForm({ ...form, category: v })} />
          <FormField label="Format" type="select" value={form.format} options={formatOptions} onChange={(v) => setForm({ ...form, format: v as GeneratedReport['format'] })} />
        </div>
      </Modal>
    </div>
  )
}

export default ReportsPage
