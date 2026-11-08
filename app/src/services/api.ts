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

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const h = await headers()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...h, ...(init.headers as Record<string, string> | undefined) },
  })
  if (res.status === 204) return null as T
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data
}

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

// --- Posts ---
export const fetchPosts = () => req<{ items: Post[] }>('/posts')
export const createPost = (d: { exerciseType: string; distance: number; duration: number; memo?: string; imageUrl?: string | null }) =>
  req<Post>('/posts', { method: 'POST', body: JSON.stringify(d) })
export const likePost = (id: string) => req<{ liked: boolean; likeCount: number }>(`/posts/${id}/likes`, { method: 'POST' })
export const unlikePost = (id: string) => req<{ liked: boolean; likeCount: number }>(`/posts/${id}/likes`, { method: 'DELETE' })
export const postComment = (id: string, content: string) =>
  req<Comment>(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) })
export const fetchComments = (id: string) => req<{ items: Comment[] }>(`/posts/${id}/comments`)

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
export const joinPlan = (postId: string, exerciseType: string) =>
  req<{ joined: boolean; participantCount: number }>(`/posts/${postId}/join`, {
    method: 'POST', body: JSON.stringify({ exerciseType }),
  })
export const leavePlan = (postId: string) =>
  req<{ joined: boolean; participantCount: number }>(`/posts/${postId}/join`, { method: 'DELETE' })
export const getParticipants = (postId: string) =>
  req<{ items: { userId: string; userName: string; exerciseType: string }[] }>(`/posts/${postId}/participants`)

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

export const fetchEvents = () => req<{ items: Event[] }>('/events')
export const createEvent = (d: Omit<Event, 'eventId' | 'createdBy' | 'createdByName' | 'participantCount' | 'createdAt'>) =>
  req<Event>('/events', { method: 'POST', body: JSON.stringify(d) })
export const fetchEvent = (id: string) => req<Event>(`/events/${id}`)
export const joinEvent = (id: string, exerciseType: string) =>
  req<{ joined: boolean; participantCount: number }>(`/events/${id}/participants`, {
    method: 'POST', body: JSON.stringify({ exerciseType }),
  })
export const leaveEvent = (id: string) =>
  req<{ joined: boolean; participantCount: number }>(`/events/${id}/participants`, { method: 'DELETE' })

export const fetchNotifications = () => req<{ items: Notification[]; unreadCount: number }>('/notifications')
export const markAllRead = () => req<{ updated: number }>('/notifications/read-all', { method: 'PUT' })

// --- Uploads ---
export const getUploadUrl = (folder = 'posts', contentType = 'image/jpeg') =>
  req<{ uploadUrl: string; imageUrl: string }>(
    `/uploads/presigned-url?folder=${folder}&contentType=${encodeURIComponent(contentType)}`
  )

export async function uploadPhoto(file: File, folder = 'posts'): Promise<string> {
  const body = await normalizePhoto(file)
  const contentType = 'image/jpeg'
  const { uploadUrl, imageUrl } = await getUploadUrl(folder, contentType)
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': contentType },
  })
  if (!res.ok) throw new Error('写真のアップロードに失敗しました')
  return imageUrl
}

// Members
export const getMembers = () => req<{ items: { userId: string; name: string; bio?: string; iconUrl?: string | null }[] }>('/members')
export const getMember = (userId: string) =>
  req<{ userId: string; name: string; bio?: string; iconUrl?: string | null; recentPosts?: Array<{ exerciseType: string; distance: number; calories: number; createdAt: string }> }>(`/members/${userId}`)
