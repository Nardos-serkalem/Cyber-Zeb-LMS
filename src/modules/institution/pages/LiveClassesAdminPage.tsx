import { useMemo, useState } from 'react'
import { CalendarClock, MonitorPlay, Radio, Video } from 'lucide-react'
import { Button } from '../../../shared/components/Button'
import { FilterTabs } from '../../../shared/components/FilterTabs'
import { PageHeader } from '../../../shared/components/PageHeader'
import { SearchInput } from '../../../shared/components/SearchInput'
import { SelectMenu } from '../../../shared/components/SelectMenu'
import { StatBlock } from '../../../shared/components/StatBlock'
import { StatusPill } from '../../../shared/components/StatusPill'
import { useToast } from '../../../shared/components/toast/ToastProvider'
import { GlassCard } from '../../../shared/layout/GlassCard'
import {
  formatAssessmentDateTime,
  resolveLiveSessionStatus,
} from '../../../shared/storage/assessmentUtils'
import { openMeetingUrl } from '../../../shared/utils/liveSessionUtils'
import { useCampusContext } from '../context/CampusContext'
import { useSyncCampusFilter } from '../hooks/useSyncCampusFilter'
import { useLiveSessions } from '../hooks/useAssessments'
import { useSyncZoomMeetingStatus } from '../hooks/useSyncZoomMeetingStatus'

const tabs = ['All', 'Live', 'Upcoming', 'Ended']

const statusTone: Record<string, 'success' | 'info' | 'neutral' | 'danger'> = {
  live: 'success',
  upcoming: 'info',
  ended: 'neutral',
  cancelled: 'danger',
}

export function LiveClassesAdminPage() {
  const { notify } = useToast()
  const { activeCampuses, selectedCampusId } = useCampusContext()
  const { records } = useLiveSessions()
  useSyncZoomMeetingStatus()
  const [activeTab, setActiveTab] = useState('All')
  const [query, setQuery] = useState('')
  const [campusFilter, setCampusFilter] = useState('all')

  useSyncCampusFilter(selectedCampusId, setCampusFilter)

  const campusOptions = useMemo(
    () => [
      { value: 'all', label: 'All campuses' },
      ...activeCampuses.map((c) => ({ value: c.id, label: c.name })),
    ],
    [activeCampuses],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      const resolved = resolveLiveSessionStatus(r)
      if (activeTab === 'Live' && resolved !== 'live') return false
      if (activeTab === 'Upcoming' && resolved !== 'upcoming') return false
      if (activeTab === 'Ended' && resolved !== 'ended') return false
      if (campusFilter !== 'all' && r.campusId !== campusFilter) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        r.courseCode.toLowerCase().includes(q) ||
        r.instructorName.toLowerCase().includes(q)
      )
    })
  }, [records, activeTab, query, campusFilter])

  const stats = useMemo(
    () => ({
      live: records.filter((r) => resolveLiveSessionStatus(r) === 'live').length,
      upcoming: records.filter((r) => resolveLiveSessionStatus(r) === 'upcoming').length,
      ended: records.filter((r) => resolveLiveSessionStatus(r) === 'ended').length,
    }),
    [records],
  )

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Live Classes"
        subtitle="Monitor live sessions scheduled by instructors across all courses."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatBlock label="Live now" value={stats.live} sub="In progress" icon={<Radio size={17} />} iconBg="bg-success-bg text-success" />
        <StatBlock label="Upcoming" value={stats.upcoming} sub="Scheduled sessions" icon={<CalendarClock size={17} />} iconBg="bg-info-bg text-info" />
        <StatBlock label="Completed" value={stats.ended} sub="Past sessions" icon={<Video size={17} />} iconBg="bg-navy-50 text-navy-600" />
      </div>

      <GlassCard className="p-4 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <FilterTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder="Search sessions…" className="sm:w-56" />
            <SelectMenu value={campusFilter} onChange={setCampusFilter} options={campusOptions} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-divider text-[11px] uppercase tracking-wider text-secondary-text">
                <th className="py-2.5 pr-4 font-semibold">Session</th>
                <th className="py-2.5 pr-4 font-semibold">Course</th>
                <th className="py-2.5 pr-4 font-semibold">Instructor</th>
                <th className="py-2.5 pr-4 font-semibold">Start</th>
                <th className="py-2.5 pr-4 font-semibold">Platform</th>
                <th className="py-2.5 pr-4 font-semibold">Status</th>
                <th className="py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((session) => {
                const resolved = resolveLiveSessionStatus(session)
                return (
                  <tr key={session.id} className="border-b border-divider/60 hover:bg-navy-50/40">
                    <td className="py-3 pr-4 font-semibold text-navy-900">{session.title}</td>
                    <td className="py-3 pr-4">{session.courseCode}</td>
                    <td className="py-3 pr-4 text-secondary-text">{session.instructorName}</td>
                    <td className="py-3 pr-4 text-secondary-text">{formatAssessmentDateTime(session.startAt)}</td>
                    <td className="py-3 pr-4">{session.platform}</td>
                    <td className="py-3 pr-4">
                      <StatusPill label={resolved} tone={statusTone[resolved] ?? 'neutral'} />
                    </td>
                    <td className="py-3 text-right">
                      {session.meetingUrl && resolved !== 'ended' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (!openMeetingUrl(session.meetingUrl)) {
                              notify('Could not open meeting link.', 'error')
                            }
                          }}
                        >
                          Open
                        </Button>
                      ) : (
                        <span className="text-[11px] text-secondary-text">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <MonitorPlay size={28} className="mx-auto text-navy-300 mb-2" />
              <p className="text-[13px] font-semibold text-navy-900">No sessions match your filters</p>
            </div>
          ) : null}
        </div>
      </GlassCard>
    </div>
  )
}

export default LiveClassesAdminPage
