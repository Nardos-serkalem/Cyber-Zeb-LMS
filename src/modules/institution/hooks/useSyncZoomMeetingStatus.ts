import { useEffect, useRef } from 'react'

import { fetchZoomMeetingStatus } from '../../../shared/api/zoomApi'
import { resolveLiveSessionStatus } from '../../../shared/storage/assessmentUtils'
import { useLiveSessions } from './useAssessments'

/** If Zoom already finished the meeting, drop the LMS session out of On air. */
export function useSyncZoomMeetingStatus() {
  const { records, updateSession } = useLiveSessions()
  const checked = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false

    const candidates = records.filter((session) => {
      const meetingId = session.zoomMeetingId?.trim()
      if (!meetingId || checked.current.has(session.id)) return false
      return resolveLiveSessionStatus(session) === 'live'
    })

    if (candidates.length === 0) return

    void Promise.all(
      candidates.map(async (session) => {
        const meetingId = session.zoomMeetingId?.trim()
        if (!meetingId) return
        checked.current.add(session.id)
        try {
          const zoom = await fetchZoomMeetingStatus(meetingId)
          if (cancelled) return
          if (zoom.status === 'finished') {
            updateSession(session.id, { status: 'ended' })
          } else {
            checked.current.delete(session.id)
          }
        } catch {
          checked.current.delete(session.id)
        }
      }),
    )

    return () => {
      cancelled = true
    }
  }, [records, updateSession])
}
