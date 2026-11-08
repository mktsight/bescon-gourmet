import { fetchAuthSession } from 'aws-amplify/auth'
import { normalizePhoto } from './image'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function headers() {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken?.toString()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

/** API エラー。`message` は従来どおり `data.error ?? res.statusText` */
export class ApiError extends Error {
  status: number
  code?: string
  data: Record<string, unknown>
  constructor(status: number, message: string, data: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = typeof data.code === 'string' ? data.code : undefined
    this.data = data
  }
}

// NOT_A_MEMBER を受けたときに TeamProvider が所属を再取得するための通知口
let notMemberHandler: (() => void) | null = null
export function setNotMemberHandler(fn: (() => void) | null) {
  notMemberHandler = fn
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const h = await headers()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...h, ...(init.headers as Record<string, string> | undefined) },
  })
  if (res.status === 204) return null as T
  let data: Record<string, unknown> | null = null
  try {
    data = await res.json()
  } catch (e) {
    if (res.ok) throw e
  }
  if (!res.ok) {
    const body = data && typeof data === 'object' ? data : {}
    const message = typeof body.error === 'string' && body.error ? body.error : (res.statusText || `HTTP ${res.status}`)
    const err = new ApiError(res.status, message, body)
    if (err.code === 'NOT_A_MEMBER') notMemberHandler?.()
    throw err
  }
  return data as T
}

const teamQuery = (teamId: string) => `teamId=${encodeURIComponent(teamId)}`

// --- 型定義 ---
export interface Post {
  postId: string
  userId: string
  userName: string
  /** 投稿者の現在のプロフィールアイコン（サーバー側で付与。未設定・未デプロイ時は無い） */
  userIconUrl?: string | null
  exerciseType: 'walking' | 'running'
  distance: number
  duration: number
  calories: number
  foodExample: string
  memo: string
  imageUrl?: string | null
  likeCount: number
  commentCount: number
  likedByMe: boolean
  createdAt: string
  /** 最後に編集した時刻（ISO8601）。未編集の投稿には無い */
  editedAt?: string
  /** 旧データ互換のため任意 */
  teamId?: string
}

export interface Comment {
  postId: string
  reactionId: string
  userId: string
  userName: string
  content: string
  createdAt: string
}

export interface Goal {
  userId: string
  goalId: string
  type: 'distance' | 'count' | 'duration' | 'calories'
  period: 'weekly' | 'monthly'
  targetValue: number
  currentValue: number
  createdAt: string
}

export interface UserProfile {
  userId: string
  name: string
  email: string
  bio: string
  gender: string
  ageGroup: string
  iconUrl: string | null
}

// --- Teams ---
export type TeamSummary = { teamId: string; name: string; memberCount: number; createdByName: string; createdAt: string; joined?: boolean }
export type MyTeam = Omit<TeamSummary, 'joined'> & { role: 'owner' | 'member'; joinedAt: string }
export type TeamMember = { userId: string; name: string; bio?: string; iconUrl?: string | null; role: 'owner' | 'member'; joinedAt: string }

export const fetchAllTeams = (q?: string) =>
  req<{ items: TeamSummary[]; truncated: boolean }>(`/teams${q ? `?q=${encodeURIComponent(q)}` : ''}`)
export const createTeam = (name: string, passphrase: string) =>
  req<{ team: MyTeam; alreadyMember?: boolean }>('/teams', { method: 'POST', body: JSON.stringify({ name, passphrase }) })
export const joinTeam = (teamId: string, passphrase: string) =>
  req<{ team: MyTeam; alreadyMember?: boolean }>(`/teams/${encodeURIComponent(teamId)}/join`, {
    method: 'POST', body: JSON.stringify({ passphrase }),
  })
export const fetchMyTeams = () =>
  req<{ items: MyTeam[]; lastTeamId: string | null; lastTeamAt: string | null }>('/me/teams')
export const saveLastTeam = (teamId: string) =>
  req<{ lastTeamId: string; lastTeamAt: string }>('/me/last-team', { method: 'PUT', body: JSON.stringify({ teamId }) })
export const fetchTeamMembers = (teamId: string) =>
  req<{ team: TeamSummary; myRole: 'owner' | 'member'; items: TeamMember[] }>(`/teams/${encodeURIComponent(teamId)}/members`)
export const leaveTeam = (teamId: string) =>
  req<void>(`/teams/${encodeURIComponent(teamId)}/members/me`, { method: 'DELETE' })
export const changePassphrase = (teamId: string, passphrase: string) =>
  req<void>(`/teams/${encodeURIComponent(teamId)}/passphrase`, { method: 'PUT', body: JSON.stringify({ passphrase }) })

const FALLBACK_TEAM_ERROR = '通信に失敗しました。もう一度お試しください'

/** チーム系 API のエラーを画面表示用の日本語にする */
export function teamErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return FALLBACK_TEAM_ERROR
  const minutes = () => {
    const sec = typeof e.data.retryAfterSec === 'number' ? e.data.retryAfterSec : 60
    return Math.max(1, Math.ceil(sec / 60))
  }
  switch (e.code) {
    case 'INVALID_PASSPHRASE': {
      const n = e.data.remainingAttempts
      return typeof n === 'number' ? `合言葉が違います（あと${n}回）` : '合言葉が違います'
    }
    case 'JOIN_LOCKED': return `試行回数が上限に達しました。${minutes()}分後にもう一度お試しください`
    case 'CREATE_LOCKED': return `チームの作成回数が上限に達しました。${minutes()}分後にもう一度お試しください`
    case 'CHANGE_LOCKED': return `合言葉の変更回数が上限に達しました。${minutes()}分後にもう一度お試しください`
    case 'TEAM_NOT_FOUND': return 'チームが見つかりません'
    case 'TEAM_FULL': return 'このチームは満員です'
    case 'TOO_MANY_TEAMS': return '参加できるチームは20個までです'
    case 'NOT_A_MEMBER': return 'このチームのメンバーではありません'
    case 'LAST_MEMBER': return '最後の1人はチームを抜けられません'
    case 'RETRY': return '処理が競合しました。もう一度お試しください'
    case 'OWNER_ONLY': return 'オーナーだけが変更できます'
    case 'VALIDATION_ERROR': return e.message
    default: return FALLBACK_TEAM_ERROR
  }
}

// --- Posts ---
export const fetchPosts = (teamId: string) => req<{ items: Post[] }>(`/posts?${teamQuery(teamId)}`)
export const createPost = (teamId: string, d: { exerciseType: string; distance: number; duration: number; memo?: string; imageUrl?: string | null }) =>
  req<Post>(`/posts?${teamQuery(teamId)}`, { method: 'POST', body: JSON.stringify(d) })
export const updatePost = (teamId: string, id: string, d: { exerciseType?: string; distance?: number; duration?: number; memo?: string; imageUrl?: string | null }) =>
  req<Post>(`/posts/${id}?${teamQuery(teamId)}`, { method: 'PUT', body: JSON.stringify(d) })
export const likePost = (teamId: string, id: string) =>
  req<{ liked: boolean; likeCount: number }>(`/posts/${id}/likes?${teamQuery(teamId)}`, { method: 'POST' })
export const unlikePost = (teamId: string, id: string) =>
  req<{ liked: boolean; likeCount: number }>(`/posts/${id}/likes?${teamQuery(teamId)}`, { method: 'DELETE' })
export const postComment = (teamId: string, id: string, content: string) =>
  req<Comment>(`/posts/${id}/comments?${teamQuery(teamId)}`, { method: 'POST', body: JSON.stringify({ content }) })
export const fetchComments = (teamId: string, id: string) =>
  req<{ items: Comment[] }>(`/posts/${id}/comments?${teamQuery(teamId)}`)

// --- Goals ---
export const fetchGoals = () => req<{ items: Goal[] }>('/goals')
export const createGoal = (d: { type: string; period: string; targetValue: number }) =>
  req<Goal>('/goals', { method: 'POST', body: JSON.stringify(d) })
export const updateGoal = (id: string, d: { targetValue?: number; currentValue?: number }) =>
  req<Goal>(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(d) })
export const deleteGoal = (id: string) => req<null>(`/goals/${id}`, { method: 'DELETE' })

// --- Profile ---
export const fetchMe = () => req<UserProfile>('/me')
export const updateMe = (d: Partial<Pick<UserProfile, 'bio' | 'gender' | 'ageGroup' | 'iconUrl'>>) =>
  req<UserProfile>('/me', { method: 'PUT', body: JSON.stringify(d) })

// --- Places ---
export interface Place {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  rating?: number
}
export const searchPlaces = (q: string, lat?: number, lng?: number) => {
  const params = new URLSearchParams({ q })
  if (lat) params.set('lat', String(lat))
  if (lng) params.set('lng', String(lng))
  return req<{ items: Place[]; status: string }>(`/places/search?${params}`)
}

// --- AI ---
export const aiSuggest = (data: {
  mode: 'restaurant' | 'exercise'
  restaurant?: { name: string; address: string }
  exerciseType?: string
  distance?: number
  duration?: number
}) => req<{ suggestion: string }>('/ai/suggest', { method: 'POST', body: JSON.stringify(data) })

// --- Plan participation ---
export const joinPlan = (teamId: string, postId: string, exerciseType: string) =>
  req<{ joined: boolean; participantCount: number }>(`/posts/${postId}/join?${teamQuery(teamId)}`, {
    method: 'POST', body: JSON.stringify({ exerciseType }),
  })
export const leavePlan = (teamId: string, postId: string) =>
  req<{ joined: boolean; participantCount: number }>(`/posts/${postId}/join?${teamQuery(teamId)}`, { method: 'DELETE' })
export const getParticipants = (teamId: string, postId: string) =>
  req<{ items: { userId: string; userName: string; exerciseType: string }[] }>(`/posts/${postId}/participants?${teamQuery(teamId)}`)

// --- Events ---
export interface Event {
  eventId: string
  title: string
  description: string
  date: string
  time: string
  location: string
  restaurantName: string
  walkingRoute: string
  runningRoute: string
  createdBy: string
  createdByName: string
  participantCount: number
  createdAt: string
  participants?: { userId: string; userName: string; exerciseType: string }[]
  joinedByMe?: boolean
  myExerciseType?: string
}

export interface Notification {
  userId: string
  notificationId: string
  type: 'like' | 'comment' | 'join' | 'achievement'
  actorName: string
  message: string
  postId: string | null
  read: boolean
  createdAt: string
}

export const fetchEvents = (teamId: string) => req<{ items: Event[] }>(`/events?${teamQuery(teamId)}`)
export const createEvent = (teamId: string, d: Omit<Event, 'eventId' | 'createdBy' | 'createdByName' | 'participantCount' | 'createdAt'>) =>
  req<Event>(`/events?${teamQuery(teamId)}`, { method: 'POST', body: JSON.stringify(d) })
export const fetchEvent = (teamId: string, id: string) => req<Event>(`/events/${id}?${teamQuery(teamId)}`)
export const joinEvent = (teamId: string, id: string, exerciseType: string) =>
  req<{ joined: boolean; participantCount: number }>(`/events/${id}/participants?${teamQuery(teamId)}`, {
    method: 'POST', body: JSON.stringify({ exerciseType }),
  })
export const leaveEvent = (teamId: string, id: string) =>
  req<{ joined: boolean; participantCount: number }>(`/events/${id}/participants?${teamQuery(teamId)}`, { method: 'DELETE' })

export const fetchNotifications = () => req<{ items: Notification[]; unreadCount: number }>('/notifications')
export const markAllRead = () => req<{ updated: number }>('/notifications/read-all', { method: 'PUT' })

// --- Uploads ---
export const getUploadUrl = (folder: string, contentType: string, size: number) =>
  req<{ uploadUrl: string; imageUrl: string }>(
    `/uploads/presigned-url?folder=${encodeURIComponent(folder)}&contentType=${encodeURIComponent(contentType)}&size=${size}`
  )

// サーバー側の上限と同じ（署名付きURLは申告サイズと違う本体を S3 が拒否する）
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export async function uploadPhoto(file: File, folder = 'posts'): Promise<string> {
  const body = await normalizePhoto(file)
  const contentType = 'image/jpeg'
  if (body.size < 1 || body.size > MAX_UPLOAD_BYTES) throw new Error('写真のアップロードに失敗しました')
  const { uploadUrl, imageUrl } = await getUploadUrl(folder, contentType, body.size)
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': contentType },
  })
  if (!res.ok) throw new Error('写真のアップロードに失敗しました')
  return imageUrl
}

// Members
export const getMembers = (teamId: string) =>
  req<{ items: { userId: string; name: string; bio?: string; iconUrl?: string | null }[] }>(`/members?${teamQuery(teamId)}`)
export const getMember = (teamId: string, userId: string) =>
  req<{ userId: string; name: string; bio?: string; iconUrl?: string | null; recentPosts?: Array<{ exerciseType: string; distance: number; calories: number; createdAt: string }> }>(`/members/${userId}?${teamQuery(teamId)}`)
