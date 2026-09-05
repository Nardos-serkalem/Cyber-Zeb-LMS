import { CalendarClock, Clock, MonitorPlay, Plus, Radio, UserRound, Video } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { PageHeader } from '../../../shared/components/PageHeader'
import { StatBlock } from '../../../shared/components/StatBlock'
import { StatusPill } from '../../../shared/components/StatusPill'
import { ZoomIcon } from '../../../shared/components/ZoomIcon'
import { useToast } from '../../../shared/components/toast/ToastProvider'
import { GlassCard } from '../../../shared/layout/GlassCard'
import { endZoomMeeting } from '../../../shared/api/zoomApi'
import { openMeetingUrl } from '../../../shared/utils/liveSessionUtils'
import { useLiveSessions } from '../../institution/hooks/useAssessments'
import { useSyncZoomMeetingStatus } from '../../institution/hooks/useSyncZoomMeetingStatus'
import { InstructorPageError, InstructorPageLoading } from '../components/InstructorPageStates'
import { ScheduleLiveSessionModal } from '../components/ScheduleLiveSessionModal'
import { useInstructorDashboard } from '../hooks/useInstructorDashboard'
import type { LiveClassSession } from '../types'

const statusTone: Record<LiveClassSession['status'], 'success' | 'info' | 'neutral'> = {
  live: 'success',
  upcoming: 'info',
  ended: 'neutral',
}

const statusLabel: Record<LiveClassSession['status'], string> = {
  live: 'Live now',
  upcoming: 'Upcoming',
  ended: 'Ended',
}

const sectionAccent: Record<LiveClassSession['status'], string> = {
  live: 'from-success/20 via-lemon-50/30 to-card-end border-success/30',
  upcoming: 'from-info-bg via-navy-50/40 to-card-end border-info/25',
  ended: 'from-navy-50 via-navy-50/30 to-card-end border-divider',
}

function PlatformBadge({ platform, onDark }: { platform: string; onDark?: boolean }) {
  const isZoom = platform.toLowerCase().includes('zoom')
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        onDark
          ? 'bg-white/10 border border-white/15 text-white/90'
          : 'soft-surface text-navy-800'
      }`}
    >
      {isZoom ? <ZoomIcon size={14} /> : <Video size={12} className="text-navy-500" />}
      {platform}
    </span>
  )
}

function LiveSessionCard({
  session,
  featured,
  onJoin,
  onEnd,
  ending,
}: {
  session: LiveClassSession
  featured?: boolean
  onJoin: (session: LiveClassSession) => void
  onEnd: (session: LiveClassSession) => void
  ending?: boolean
}) {
  const isLive = session.status === 'live'

  if (featured && isLive) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-success/40 hero-banner-br shadow-[0_8px_32px_rgba(22,163,74,0.12)]">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-lemon-500/10 blur-3xl pointer-events-none" />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-success/20 border border-success/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live now
            </div>
            <h2 className="mt-4 text-[22px] md:text-[26px] font-bold text-white leading-tight">{session.title}</h2>
            <p className="mt-2 text-[13px] text-[#c5cade]">{session.course}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="hero-banner-chip">
                <CalendarClock size={13} />
                {session.startAt}
              </span>
              <span className="hero-banner-chip">
                <Clock size={13} />
                {session.duration}
              </span>
              {session.attendees !== undefined ? (
                <span className="hero-banner-chip">
                  <UserRound size={13} />
                  {session.attendees} attendees
                </span>
              ) : null}
              <PlatformBadge platform={session.platform} onDark />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button variant="primary" className="shadow-lg shadow-lemon-500/25" onClick={() => onJoin(session)}>
              <MonitorPlay size={16} />
              Start session
            </Button>
            <Button variant="secondary" onClick={() => onEnd(session)} disabled={ending}>
              {ending ? 'Ending…' : 'End session'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <GlassCard
      className={`p-0 overflow-hidden hover:shadow-md transition-shadow border bg-gradient-to-br ${sectionAccent[session.status]}`}
    >
      <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
        <div
          className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
            isLive ? 'bg-success text-white' : session.status === 'upcoming' ? 'bg-info text-white' : 'bg-navy-100 text-navy-500'
          }`}
        >
          {isLive ? <Radio size={20} /> : session.status === 'upcoming' ? <CalendarClock size={20} /> : <Video size={20} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={statusLabel[session.status]} tone={statusTone[session.status]} />
            <PlatformBadge platform={session.platform} />
          </div>
          <h3 className="mt-2 text-[15px] font-bold text-navy-900 leading-snug">{session.title}</h3>
          <p className="mt-1 text-[12px] text-secondary-text">{session.course}</p>

          <div className="mt-3 flex flex-wrap gap-2 text-[11.5px] text-secondary-text">
            <span className="schedule-meta-chip">
              <CalendarClock size={11} />
              {session.startAt}
            </span>
            <span className="schedule-meta-chip">
              <Clock size={11} />
              {session.duration}
            </span>
            {session.attendees !== undefined ? (
              <span className="schedule-meta-chip">
                <UserRound size={11} />
                {session.attendees} attended
              </span>
            ) : null}
          </div>
        </div>

        {session.status !== 'ended' ? (
          <div className="flex flex-col gap-2 shrink-0 self-start sm:self-center">
            <Button
              variant={session.status === 'live' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => onJoin(session)}
            >
              <Video size={13} />
              {session.status === 'live' ? 'Start' : session.meetingUrl ? 'Open link' : 'Start'}
            </Button>
            {session.status === 'live' ? (
              <Button variant="secondary" size="sm" onClick={() => onEnd(session)} disabled={ending}>
                {ending ? 'Ending…' : 'End session'}
              </Button>
            ) : null}
          </div>
        ) : (
          <span className="text-[11px] font-semibold text-secondary-text shrink-0">Recording saved</span>
        )}
      </div>
    </GlassCard>
  )
}

function SessionSection({
  title,
  subtitle,
  sessions,
  featuredFirst,
  onJoin,
  onEnd,
  endingId,
}: {
  title: string
  subtitle: string
  sessions: LiveClassSession[]
  featuredFirst?: boolean
  onJoin: (session: LiveClassSession) => void
  onEnd: (session: LiveClassSession) => void
  endingId?: string | null
}) {
  if (sessions.length === 0) return null

  const [first, ...rest] = sessions

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-navy-900">{title}</h2>
        <p className="text-[12px] text-secondary-text mt-0.5">{subtitle}</p>
      </div>
      {featuredFirst && first ? (
        <LiveSessionCard
          session={first}
          featured
          onJoin={onJoin}
          onEnd={onEnd}
          ending={endingId === first.id}
        />
      ) : null}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(featuredFirst ? rest : sessions).map((session) => (
          <LiveSessionCard
            key={session.id}
            session={session}
            onJoin={onJoin}
            onEnd={onEnd}
            ending={endingId === session.id}
          />
        ))}
      </div>
    </section>
  )
}

export function InstructorLiveClassesPage() {
  const { notify } = useToast()
  const { data, isLoading, isError, reload } = useInstructorDashboard()
  const { records, updateSession } = useLiveSessions()
  const [modalOpen, setModalOpen] = useState(false)
  const [endingId, setEndingId] = useState<string | null>(null)
  useSyncZoomMeetingStatus()

  const handleJoin = (session: LiveClassSession) => {
    if (!openMeetingUrl(session.startUrl || session.meetingUrl)) {
      notify('No Zoom meeting has been created for this session yet.', 'error')
    }
  }

  const handleEnd = async (session: LiveClassSession) => {
    const record = records.find((item) => item.id === session.id)
    setEndingId(session.id)
    updateSession(session.id, { status: 'ended' })
    try {
      if (record?.zoomMeetingId) {
        await endZoomMeeting(record.zoomMeetingId)
      }
      notify('Session ended. It is no longer on air.')
    } catch (error) {
      notify(
        error instanceof Error
          ? `${error.message} The session is marked ended in Berana.`
          : 'Session marked ended in Berana.',
        'info',
      )
    } finally {
      setEndingId(null)
    }
  }

  if (isLoading) return <InstructorPageLoading />
  if (isError || !data) return <InstructorPageError message="Failed to load live classes." />

  const liveNow = data.liveClasses.filter((s) => s.status === 'live')
  const upcoming = data.liveClasses.filter((s) => s.status === 'upcoming')
  const ended = data.liveClasses.filter((s) => s.status === 'ended')

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Live Classes"
        subtitle="Schedule, host, and manage virtual lectures and lab sessions."
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} />
            Schedule session
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatBlock
          label="Live now"
          value={liveNow.length}
          sub="Sessions in progress"
          icon={<Radio size={17} />}
          iconBg="bg-success-bg text-success"
        />
        <StatBlock
          label="Upcoming"
          value={upcoming.length}
          sub="Scheduled this week"
          icon={<CalendarClock size={17} />}
          iconBg="bg-info-bg text-info"
        />
        <StatBlock
          label="Completed"
          value={ended.length}
          sub="Recordings available"
          icon={<Video size={17} />}
          iconBg="bg-navy-50 text-navy-600"
        />
      </div>

      <SessionSection
        title="On air"
        subtitle="Sessions happening right now."
        sessions={liveNow}
        featuredFirst
        onJoin={handleJoin}
        onEnd={(session) => void handleEnd(session)}
        endingId={endingId}
      />

      <SessionSection
        title="Coming up"
        subtitle="Prepare materials before class starts."
        sessions={upcoming}
        onJoin={handleJoin}
        onEnd={(session) => void handleEnd(session)}
        endingId={endingId}
      />

      <SessionSection
        title="Recent sessions"
        subtitle="Review attendance and recordings from past sessions."
        sessions={ended}
        onJoin={handleJoin}
        onEnd={(session) => void handleEnd(session)}
        endingId={endingId}
      />

      {data.liveClasses.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <MonitorPlay size={32} className="mx-auto text-navy-300 mb-3" />
          <p className="text-[14px] font-semibold text-navy-900">No live sessions scheduled</p>
          <p className="text-[12.5px] text-secondary-text mt-1">
            Create a Zoom meeting and schedule a session for your students.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => setModalOpen(true)}>
            <Plus size={15} />
            Schedule session
          </Button>
        </GlassCard>
      ) : null}

      <ScheduleLiveSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        courses={data.courses}
        instructorId={data.instructorId}
        instructorName={data.instructorName}
        onScheduled={() => void reload()}
      />
    </div>
  )
}

export default InstructorLiveClassesPage
