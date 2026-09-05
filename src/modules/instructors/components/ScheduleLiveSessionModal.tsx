import { useEffect, useState } from 'react'
import { MonitorPlay } from 'lucide-react'
import { Button } from '../../../shared/components/Button'
import { FormField } from '../../../shared/components/FormField'
import { Modal } from '../../../shared/components/Modal'
import { useToast } from '../../../shared/components/toast/ToastProvider'
import { createZoomMeeting, fetchZoomStatus } from '../../../shared/api/zoomApi'
import { useLiveSessions } from '../../institution/hooks/useAssessments'
import type { TeachingCourse } from '../types'

const emptyForm = {
  title: '',
  courseId: '',
  startAt: '',
  durationMinutes: '60',
}

function minDateTimeLocalValue(): string {
  const now = new Date()
  now.setSeconds(0, 0)
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

interface ScheduleLiveSessionModalProps {
  open: boolean
  onClose: () => void
  courses: TeachingCourse[]
  instructorId: string
  instructorName: string
  onScheduled?: () => void
}

export function ScheduleLiveSessionModal({
  open,
  onClose,
  courses,
  instructorId,
  instructorName,
  onScheduled,
}: ScheduleLiveSessionModalProps) {
  const { notify } = useToast()
  const { createSession } = useLiveSessions()
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [zoomReady, setZoomReady] = useState<boolean | null>(null)
  const [zoomUnreachable, setZoomUnreachable] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetchZoomStatus().then((status) => {
      if (cancelled) return
      setZoomReady(status.configured)
      setZoomUnreachable(!status.reachable)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const handleClose = () => {
    if (submitting) return
    setForm(emptyForm)
    onClose()
  }

  const handleCreate = async () => {
    const teachingCourse = courses.find((c) => c.id === form.courseId)

    if (!teachingCourse || !form.title.trim() || !form.startAt) {
      notify('Fill in title, course, and start time.', 'error')
      return
    }

    const start = new Date(form.startAt)
    if (Number.isNaN(start.getTime())) {
      notify('Pick a valid start date and time.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const meeting = await createZoomMeeting({
        topic: `${teachingCourse.code} — ${form.title.trim()}`,
        startAt: start.toISOString(),
        durationMinutes: Number(form.durationMinutes) || 60,
      })

      createSession({
        title: form.title.trim(),
        courseId: teachingCourse.id,
        courseCode: teachingCourse.code,
        courseTitle: teachingCourse.title,
        instructorId,
        instructorName,
        campusId: 'c1',
        department: teachingCourse.department,
        startAt: start.toISOString(),
        durationMinutes: Number(form.durationMinutes) || 60,
        platform: 'Zoom',
        meetingUrl: meeting.join_url,
        startUrl: meeting.start_url,
        zoomMeetingId: meeting.meeting_id,
        zoomPassword: meeting.password || undefined,
        status: 'upcoming',
      })

      notify('Zoom meeting created and scheduled for your students.')
      setForm(emptyForm)
      onClose()
      onScheduled?.()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create the Zoom meeting.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Schedule live session"
      description="Berana creates a Zoom meeting with your account. Students get the join link automatically."
      icon={<MonitorPlay size={18} />}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" onClick={() => void handleCreate()} disabled={submitting}>
            {submitting ? 'Creating Zoom meeting…' : 'Schedule on Zoom'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {zoomUnreachable ? (
          <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Could not reach the API Zoom status endpoint. You can still try scheduling — if the API is down, Zoom creation will fail with a clearer error.
          </p>
        ) : null}
        {zoomReady === false && !zoomUnreachable ? (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            Zoom Server-to-Server credentials are missing on the API. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET in backend/.env, then restart the API.
          </p>
        ) : null}
        <FormField
          label="Session title"
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder="e.g. Week 4 — Live Lab"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-navy-900">Course</span>
          <select
            value={form.courseId}
            onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
            className="w-full bg-white border border-divider rounded-lg px-3 py-2 text-[13px]"
          >
            <option value="">Select your course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </label>
        <FormField
          label="Start date & time"
          value={form.startAt}
          onChange={(v) => setForm((f) => ({ ...f, startAt: v }))}
          type="datetime-local"
          min={minDateTimeLocalValue()}
          hint="Local date and time when your class starts."
        />
        <FormField
          label="Duration (minutes)"
          value={form.durationMinutes}
          onChange={(v) => setForm((f) => ({ ...f, durationMinutes: v }))}
          type="number"
        />
        <p className="text-[12px] text-secondary-text">
          A Zoom meeting is created through the Server-to-Server API. Instructors open the host start
          link; students open the join link. The Zoom app must include the scope
          meeting:write:meeting:admin and then be activated again.
        </p>
      </div>
    </Modal>
  )
}
