import { apiClient } from './client'

export interface ZoomMeeting {
  meeting_id: string
  join_url: string
  start_url: string
  password: string
  topic: string
}

function zoomErrorMessage(error: unknown): string {
  const axiosError = error as {
    response?: { data?: { error?: { message?: string }; detail?: string } }
    message?: string
  }
  return (
    axiosError.response?.data?.error?.message ||
    axiosError.response?.data?.detail ||
    axiosError.message ||
    'Could not create the Zoom meeting.'
  )
}

export async function fetchZoomStatus(): Promise<{ configured: boolean; reachable: boolean }> {
  try {
    const { data } = await apiClient.get<{ configured: boolean }>('/live-sessions/zoom/status')
    return { configured: Boolean(data.configured), reachable: true }
  } catch {
    return { configured: false, reachable: false }
  }
}

export async function createZoomMeeting(input: {
  topic: string
  startAt: string
  durationMinutes: number
}): Promise<ZoomMeeting> {
  try {
    const { data } = await apiClient.post<ZoomMeeting>('/live-sessions/zoom/meetings', {
      topic: input.topic,
      start_at: input.startAt,
      duration_minutes: input.durationMinutes,
    })
    return data
  } catch (error) {
    throw new Error(zoomErrorMessage(error))
  }
}

export async function fetchZoomMeetingStatus(
  meetingId: string,
): Promise<{ meeting_id: string; status: string }> {
  try {
    const { data } = await apiClient.get<{ meeting_id: string; status: string }>(
      `/live-sessions/zoom/meetings/${encodeURIComponent(meetingId)}`,
    )
    return data
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 404) return { meeting_id: meetingId, status: 'finished' }
    throw error
  }
}

export async function endZoomMeeting(
  meetingId: string,
): Promise<{ meeting_id: string; status: string }> {
  try {
    const { data } = await apiClient.post<{ meeting_id: string; status: string }>(
      `/live-sessions/zoom/meetings/${encodeURIComponent(meetingId)}/end`,
    )
    return data
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status
    // Already ended in Zoom, or the meeting no longer exists.
    if (status === 404) return { meeting_id: meetingId, status: 'finished' }
    throw new Error(zoomErrorMessage(error))
  }
}
