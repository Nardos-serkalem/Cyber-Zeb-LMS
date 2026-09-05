import { CalendarClock, Clock, MonitorPlay, Radio, UserRound, Video } from 'lucide-react'
import { Button } from '../../../shared/components/Button'
import { PageHeader } from '../../../shared/components/PageHeader'
import { StatBlock } from '../../../shared/components/StatBlock'
import { StatusPill } from '../../../shared/components/StatusPill'
import { ZoomIcon } from '../../../shared/components/ZoomIcon'
import { useToast } from '../../../shared/components/toast/ToastProvider'
import { GlassCard } from '../../../shared/layout/GlassCard'
import { openMeetingUrl } from '../../../shared/utils/liveSessionUtils'
import { useSyncZoomMeetingStatus } from '../../institution/hooks/useSyncZoomMeetingStatus'
import { StudentPageError, StudentPageLoading } from '../components/StudentPageStates'
import { useStudentDashboard } from '../hooks/useStudentDashboard'
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
}: {
  session: LiveClassSession
  featured?: boolean
  onJoin: (session: LiveClassSession) => void
}) {
  const isLive = session.status === 'live'

  if (featured && isLive) {
    return (
      <GlassCard className="relative overflow-hidden p-0 border-success/40 shadow-[0_8px_32px_rgba(22,163,74,0.12)]">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-lemon-500/10 blur-3xl" />
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
            <p className="mt-2 text-[13px] text-navy-200">
              {session.course} · {session.instructor}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11.5px] text-white/90">
                <CalendarClock size={13} />
                {session.startAt}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11.5px] text-white/90">
                <Clock size={13} />
                {session.duration}
              </span>
              <PlatformBadge platform={session.platform} onDark />
            </div>
          </div>
          <Button variant="primary" className="shrink-0 shadow-lg shadow-lemon-500/25" onClick={() => onJoin(session)}>
            <MonitorPlay size={16} />
            Join session
          </Button>
        </div>
      </GlassCard>
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
          <p className="mt-1 text-[12px] text-secondary-text flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <UserRound size={12} />
              {session.instructor}
            </span>
            <span>{session.course}</span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-[11.5px] text-secondary-text">
            <span className="schedule-meta-chip">
              <CalendarClock size={11} />
              {session.startAt}
            </span>
            <span className="schedule-meta-chip">
              <Clock size={11} />
              {session.duration}
            </span>
          </div>
        </div>

        {session.status !== 'ended' ? (
          <Button
            variant={session.status === 'live' ? 'primary' : 'secondary'}
            size="sm"
            className="shrink-0 self-start sm:self-center"
            onClick={() => onJoin(session)}
          >
            <Video size={13} />
            {session.status === 'live' ? 'Join' : session.meetingUrl ? 'Open link' : 'Join'}
          </Button>
        ) : (
          <span className="text-[11px] font-semibold text-secondary-text shrink-0">Recording available</span>
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
}: {
  title: string
  subtitle: string
  sessions: LiveClassSession[]
  featuredFirst?: boolean
  onJoin: (session: LiveClassSession) => void
}) {
  if (sessions.length === 0) return null

  const [first, ...rest] = sessions

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-navy-900">{title}</h2>
        <p className="text-[12px] text-secondary-text mt-0.5">{subtitle}</p>
      </div>
      {featuredFirst && first ? <LiveSessionCard session={first} featured onJoin={onJoin} /> : null}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(featuredFirst ? rest : sessions).map((session) => (
          <LiveSessionCard key={session.id} session={session} onJoin={onJoin} />
        ))}
      </div>
    </section>
  )
}

export function StudentLiveClassesPage() {
  const { notify } = useToast()
  const { data, isLoading, isError } = useStudentDashboard()
  useSyncZoomMeetingStatus()

  const handleJoin = (session: LiveClassSession) => {
    if (!openMeetingUrl(session.meetingUrl)) {
      notify('No meeting link is set for this session yet.', 'error')
    }
  }

  if (isLoading) return <StudentPageLoading />
  if (isError || !data) return <StudentPageError message="Failed to load live classes." />

  const liveNow = data.liveClasses.filter((s) => s.status === 'live')
  const upcoming = data.liveClasses.filter((s) => s.status === 'upcoming')
  const ended = data.liveClasses.filter((s) => s.status === 'ended')

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Live Classes"
        subtitle="Join lectures and labs in real time — your virtual classroom schedule."
        actions={
          liveNow.length > 0 ? (
            <Button variant="primary" onClick={() => handleJoin(liveNow[0])}>
              <MonitorPlay size={15} />
              Join live session
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatBlock
          label="Live now"
          value={liveNow.length}
          sub={liveNow.length === 1 ? 'Session in progress' : 'Sessions in progress'}
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
          sub="Recordings on demand"
          icon={<Video size={17} />}
          iconBg="bg-navy-50 text-navy-600"
        />
      </div>

      <SessionSection
        title="On air"
        subtitle="Sessions happening right now — join before they end."
        sessions={liveNow}
        featuredFirst
        onJoin={handleJoin}
      />

      <SessionSection
        title="Coming up"
        subtitle="Save a reminder and be ready when class starts."
        sessions={upcoming}
        onJoin={handleJoin}
      />

      <SessionSection
        title="Recent sessions"
        subtitle="Catch up with recordings from past live classes."
        sessions={ended}
        onJoin={handleJoin}
      />

      {data.liveClasses.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <MonitorPlay size={32} className="mx-auto text-navy-300 mb-3" />
          <p className="text-[14px] font-semibold text-navy-900">No live sessions scheduled</p>
          <p className="text-[12.5px] text-secondary-text mt-1">Check back when your instructor publishes a session.</p>
        </GlassCard>
      ) : null}
    </div>
  )
}

export default StudentLiveClassesPage
