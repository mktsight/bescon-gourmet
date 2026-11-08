'use strict'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
// 署名付きURLに空ボディのCRC32が含まれ、実ファイルのPUTがBadDigestで失敗するのを防ぐ
const s3Client = new S3Client({ region: 'ap-northeast-1', requestChecksumCalculation: 'WHEN_REQUIRED' })
const UPLOAD_BUCKET = 'bescon-gourmet-uploads-897729110502'
const UPLOAD_URL_BASE = `https://${UPLOAD_BUCKET}.s3.ap-northeast-1.amazonaws.com/`
const POST_IMAGE_PREFIX = UPLOAD_URL_BASE + 'posts/'
const POST_IMAGE_KEY_RE = /^[A-Za-z0-9._-]{1,120}$/

const { normalizePassphrase, hashPassphrase, verifyPassphrase, PassphraseError } = require('./passphrase')

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }))

const T = {
  users: 'bescon-users',
  posts: 'bescon-posts',
  goals: 'bescon-goals',
  reactions: 'bescon-reactions',
  notifications: 'bescon-notifications',
  events: 'bescon-events',
  participants: 'bescon-participants',
  teams: 'bescon-teams',
  teamMembers: 'bescon-team-members',
  teamAttempts: 'bescon-team-attempts',
}

const MAX_TEAM_MEMBERS = 100
const MAX_TEAMS_PER_USER = 20
const TEAM_ID_RE = /^team_[A-Za-z0-9_]{1,64}$/
const JOIN_WINDOW_MS = 15 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

const METS = { walking: 3.5, running: 7.0 }
const WEIGHTS = {
  male:   { '10s': 60, '20s': 68, '30s': 72, '40s': 74, '50s': 73, '60s': 70 },
  female: { '10s': 50, '20s': 52, '30s': 54, '40s': 55, '50s': 55, '60s': 53 },
  other:  { '10s': 55, '20s': 60, '30s': 63, '40s': 64, '50s': 63, '60s': 61 },
}

function calcCalories(exerciseType, durationMin, gender, ageGroup) {
  const met = METS[exerciseType] ?? 3.5
  const weight = (WEIGHTS[gender] ?? WEIGHTS.other)[ageGroup] ?? 65
  return Math.round(met * weight * (durationMin / 60))
}

function foodExample(kcal) {
  if (kcal < 100) return 'おにぎり0.5個分！'
  if (kcal < 200) return 'おにぎり1個分！'
  if (kcal < 300) return 'ラーメン0.5杯分！'
  if (kcal < 400) return 'ラーメン1杯分！'
  if (kcal < 500) return '焼肉定食0.5人前！'
  if (kcal < 700) return '焼肉定食1人前！'
  return 'すき焼き1人前！'
}

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
const r = (s, b) => ({ statusCode: s, headers: CORS, body: JSON.stringify(b) })
const ok = b => r(200, b)
const created = b => r(201, b)
const noContent = () => ({ statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }, body: '' })
const notFound = m => r(404, { error: m ?? 'Not found' })
const badRequest = m => r(400, { error: m ?? 'Bad request' })
const serverError = () => r(500, { error: 'サーバーでエラーが発生しました', code: 'INTERNAL' })

// code ごとの既定メッセージ（画面のフォールバック表示用）
const ERROR_MESSAGES = {
  TEAM_ID_REQUIRED: 'チームが指定されていません',
  INVALID_TEAM_ID: 'チームの指定が正しくありません',
  NOT_A_MEMBER: 'このチームのメンバーではありません',
  INVALID_PASSPHRASE: '合言葉が違います',
  OWNER_ONLY: 'オーナーだけが変更できます',
  TEAM_NOT_FOUND: 'チームが見つかりません',
  POST_NOT_FOUND: '投稿が見つかりません',
  NOT_POST_OWNER: '自分の投稿だけ編集できます',
  EVENT_NOT_FOUND: 'イベントが見つかりません',
  TEAM_FULL: 'このチームは満員です',
  TOO_MANY_TEAMS: `参加できるチームは${MAX_TEAMS_PER_USER}個までです`,
  LAST_MEMBER: '最後の1人はチームを抜けられません',
  RETRY: '処理が競合しました。もう一度お試しください',
  JOIN_LOCKED: '試行回数が上限に達しました。しばらくしてからお試しください',
  CREATE_LOCKED: 'チームの作成回数が上限に達しました。しばらくしてからお試しください',
  CHANGE_LOCKED: '合言葉の変更回数が上限に達しました。しばらくしてからお試しください',
  INTERNAL: 'サーバーでエラーが発生しました',
}

class HttpError extends Error {
  constructor(status, code, extra = {}, message) {
    super(message ?? ERROR_MESSAGES[code] ?? code)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

const isCondFail = e => e?.name === 'ConditionalCheckFailedException'
const nowIso = () => new Date().toISOString()

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function claimUserName(claims) {
  return claims.name ?? (claims.email ?? '').split('@')[0] ?? 'メンバー'
}

function validationError(field, message) {
  return new HttpError(400, 'VALIDATION_ERROR', { field }, message)
}

// ---- チーム: 入力検証 ----

function checkTeamId(raw) {
  if (raw === undefined || raw === null || raw === '') throw new HttpError(400, 'TEAM_ID_REQUIRED')
  if (typeof raw !== 'string' || !TEAM_ID_RE.test(raw)) throw new HttpError(400, 'INVALID_TEAM_ID')
  return raw
}

function getTeamId(event) {
  return checkTeamId(event.queryStringParameters?.teamId)
}

function parsePassphrase(raw) {
  try {
    return normalizePassphrase(raw)
  } catch (e) {
    if (e instanceof PassphraseError) throw validationError('passphrase', e.message)
    throw e
  }
}

// 見た目を偽装した名前を防ぐ。絵文字に挟まれたZWJだけは結合絵文字として許可する。
function parseTeamName(raw) {
  if (typeof raw !== 'string') throw validationError('name', 'チーム名を入力してください')
  const name = raw.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (!name) throw validationError('name', 'チーム名を入力してください')
  if ([...name].length > 30) throw validationError('name', 'チーム名は30文字以内で入力してください')
  const stripped = name.replace(/(?<=\p{Extended_Pictographic}\uFE0F?)\u200D(?=\p{Extended_Pictographic})/gu, '')
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(stripped)) throw validationError('name', 'チーム名に使えない文字が含まれています')
  return name
}

// ---- 投稿: 入力検証（POST /posts と PUT /posts/{id} で共通） ----

// 未指定・null・'' は「写真なし」。文字列はこのアプリのアップロード先 posts/ 配下のURLだけ許可する。
function parseImageUrl(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  const invalid = () => validationError('imageUrl', '写真のURLが正しくありません')
  if (typeof raw !== 'string' || !raw.startsWith(POST_IMAGE_PREFIX)) throw invalid()
  if (!POST_IMAGE_KEY_RE.test(raw.slice(POST_IMAGE_PREFIX.length))) throw invalid()
  return raw
}

function parseNumberField(field, raw, max, label) {
  const bad = () => validationError(field, `${label}は0〜${max}の数値で入力してください`)
  if (typeof raw === 'string' ? !raw.trim() : typeof raw !== 'number') throw bad()
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > max) throw bad()
  return n
}

// body の指定があればそれを、無ければ base を使い、結果を検証して正規化する（部分更新でも他の項目を壊さない）。
function parsePostFields(body, base = {}) {
  const pick = (key, dflt) => (body[key] !== undefined ? body[key] : (base[key] !== undefined ? base[key] : dflt))
  const exerciseType = pick('exerciseType', 'walking')
  if (exerciseType !== 'walking' && exerciseType !== 'running') {
    throw validationError('exerciseType', '運動の種類が正しくありません')
  }
  const distance = parseNumberField('distance', pick('distance', 0), 1000, '距離')
  const duration = parseNumberField('duration', pick('duration', 0), 1440, '時間')
  const memo = pick('memo', '')
  if (typeof memo !== 'string') throw validationError('memo', 'コメントが正しくありません')
  if ([...memo].length > 500) throw validationError('memo', 'コメントは500文字以内で入力してください')
  return { exerciseType, distance, duration, memo }
}

// ---- チーム: 所属・認可 ----

async function getMembership(teamId, userId) {
  const { Item } = await ddb.send(new GetCommand({ TableName: T.teamMembers, Key: { teamId, userId }, ConsistentRead: true }))
  return Item ?? null
}

async function requireMember(teamId, userId) {
  const m = await getMembership(teamId, userId)
  if (!m) {
    console.warn('Not a team member:', userId, teamId)
    throw new HttpError(403, 'NOT_A_MEMBER')
  }
  return m
}

async function isMember(teamId, userId) {
  return !!(await getMembership(teamId, userId))
}

async function requireTeamScope(event, userId) {
  const teamId = getTeamId(event)
  await requireMember(teamId, userId)
  return teamId
}

// 投稿が指定チームのものでなければ（teamId の無い旧投稿を含む）404。他チームの投稿の存在を明かさない。
async function loadTeamPost(postId, teamId) {
  const { Item } = await ddb.send(new GetCommand({ TableName: T.posts, Key: { postId } }))
  if (!Item || Item.teamId !== teamId) throw new HttpError(404, 'POST_NOT_FOUND')
  return Item
}

async function loadTeamEvent(eventId, teamId) {
  const { Item } = await ddb.send(new GetCommand({ TableName: T.events, Key: { eventId } }))
  if (!Item || Item.teamId !== teamId) throw new HttpError(404, 'EVENT_NOT_FOUND')
  return Item
}

// users 項目が無ければ作る。同時に呼ばれても先に付いた lastTeamId を消さないよう条件付き Put にする。
async function ensureProfile(userId, claims) {
  const key = { TableName: T.users, Key: { userId }, ConsistentRead: true }
  const { Item } = await ddb.send(new GetCommand(key))
  if (Item) return Item
  const prof = {
    userId, name: claimUserName(claims), email: claims.email ?? '', bio: '',
    gender: claims['custom:gender'] ?? 'other',
    ageGroup: claims['custom:agegroup'] ?? '30s',
    iconUrl: null, createdAt: nowIso(),
  }
  try {
    await ddb.send(new PutCommand({ TableName: T.users, Item: prof, ConditionExpression: 'attribute_not_exists(userId)' }))
    return prof
  } catch (e) {
    if (!isCondFail(e)) throw e
    const { Item: existing } = await ddb.send(new GetCommand(key))
    return existing ?? prof
  }
}

// 返却フィールドのホワイトリスト（合言葉関連の属性は絶対に含めない）
function publicTeam(item, extras = {}) {
  return {
    teamId: item.teamId,
    name: item.name,
    memberCount: item.memberCount ?? 0,
    createdByName: item.createdByName ?? '',
    createdAt: item.createdAt,
    ...extras,
  }
}

const TEAM_PUBLIC_READ = {
  ProjectionExpression: 'teamId, #n, memberCount, createdByName, createdAt',
  ExpressionAttributeNames: { '#n': 'name' },
}

// 試行回数を検証の前に原子的に先取りする（並列リクエストでも上限を超えない）。先取り後の attempts を返す。
async function reserveAttempt(attemptKey, max, windowMs, lockedCode) {
  const now = Date.now()
  const floor = now - windowMs
  const names = { '#k': 'attemptKey', '#a': 'attempts', '#w': 'windowStart', '#e': 'expiresAt' }
  try {
    await ddb.send(new UpdateCommand({
      TableName: T.teamAttempts, Key: { attemptKey },
      UpdateExpression: 'SET #a = :one, #w = :now, #e = :exp',
      ConditionExpression: 'attribute_not_exists(#k) OR #w <= :floor',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: { ':one': 1, ':now': now, ':exp': Math.floor(now / 1000) + 86400, ':floor': floor },
    }))
    return 1
  } catch (e) {
    if (!isCondFail(e)) throw e
  }
  try {
    const { Attributes } = await ddb.send(new UpdateCommand({
      TableName: T.teamAttempts, Key: { attemptKey },
      UpdateExpression: 'ADD #a :one',
      ConditionExpression: '#w > :floor AND #a < :max',
      ExpressionAttributeNames: { '#a': 'attempts', '#w': 'windowStart' },
      ExpressionAttributeValues: { ':one': 1, ':floor': floor, ':max': max },
      ReturnValues: 'UPDATED_NEW',
    }))
    return Attributes.attempts
  } catch (e) {
    if (!isCondFail(e)) throw e
  }
  const { Item } = await ddb.send(new GetCommand({ TableName: T.teamAttempts, Key: { attemptKey }, ConsistentRead: true }))
  const retryAfterSec = Item ? Math.max(1, Math.ceil((Item.windowStart + windowMs - Date.now()) / 1000)) : 1
  console.warn('Attempt limit reached:', lockedCode, attemptKey)
  throw new HttpError(429, lockedCode, { retryAfterSec })
}

// name/iconUrl/bio を users から GetItem の並列で取得する（BatchGetItem は IAM で拒否されている）。
async function loadUserProfiles(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]
  const entries = await Promise.all(ids.map(async id => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: T.users, Key: { userId: id },
        ProjectionExpression: '#n, iconUrl, bio', ExpressionAttributeNames: { '#n': 'name' },
      }))
      return [id, Item ?? null]
    } catch (e) {
      console.warn('Profile lookup failed:', id, e)
      return [id, null]
    }
  }))
  return new Map(entries)
}

async function queryAll(input, maxPages = 10) {
  const items = []
  let ExclusiveStartKey
  for (let i = 0; i < maxPages; i++) {
    const res = await ddb.send(new QueryCommand({ ...input, ExclusiveStartKey }))
    items.push(...(res.Items ?? []))
    ExclusiveStartKey = res.LastEvaluatedKey
    if (!ExclusiveStartKey) break
  }
  return items
}

async function scanAll(input, maxPages = 10) {
  const items = []
  let ExclusiveStartKey
  let truncated = false
  for (let i = 0; i < maxPages; i++) {
    const res = await ddb.send(new ScanCommand({ ...input, ExclusiveStartKey }))
    items.push(...(res.Items ?? []))
    ExclusiveStartKey = res.LastEvaluatedKey
    if (!ExclusiveStartKey) break
    if (i === maxPages - 1) truncated = true
  }
  return { items, truncated }
}

// 自分の所属（GSI。結果整合なので認可には使わない）
function listMemberships(userId) {
  return queryAll({
    TableName: T.teamMembers, IndexName: 'userId-teamId-index',
    KeyConditionExpression: 'userId = :u', ExpressionAttributeValues: { ':u': userId },
  })
}

// 基底テーブルの強整合 Query（GSI は結果整合のため脱退直後の人が残って見える）
function listTeamMembers(teamId) {
  return queryAll({
    TableName: T.teamMembers, ConsistentRead: true,
    KeyConditionExpression: 'teamId = :t', ExpressionAttributeValues: { ':t': teamId },
  }, 5)
}

async function getTeamPublic(teamId) {
  const { Item } = await ddb.send(new GetCommand({ TableName: T.teams, Key: { teamId }, ConsistentRead: true, ...TEAM_PUBLIC_READ }))
  return Item ?? null
}

// lastTeamId/lastTeamAt（サーバー時刻の版）を書く。users 項目が無ければ作らない。
async function setLastTeam(userId, teamId) {
  const lastTeamAt = nowIso()
  await ddb.send(new UpdateCommand({
    TableName: T.users, Key: { userId },
    UpdateExpression: 'SET lastTeamId = :t, lastTeamAt = :now',
    ConditionExpression: 'attribute_exists(userId)',
    ExpressionAttributeValues: { ':t': teamId, ':now': lastTeamAt },
  }))
  return lastTeamAt
}

async function setLastTeamBestEffort(userId, teamId) {
  try { await setLastTeam(userId, teamId) } catch (e) { console.warn('Last team update failed:', userId, teamId, e?.name) }
}

// メンバー一覧（owner 先頭、次に joinedAt 昇順）。memberCount がずれていたら比較交換で自己修復する。
async function loadTeamMembersView(teamId, userId) {
  const me = await requireMember(teamId, userId)
  const team = await getTeamPublic(teamId)
  if (!team) throw new HttpError(404, 'TEAM_NOT_FOUND')
  const members = await listTeamMembers(teamId)
  const old = team.memberCount
  const observed = members.length
  let memberCount = old ?? 0
  const cutoff = Date.now() - 60 * 1000
  if (observed !== old && members.every(m => Date.parse(m.joinedAt) < cutoff)) {
    try {
      const values = { ':n': observed }
      let cond = 'attribute_exists(teamId) AND attribute_not_exists(#mc)'
      if (old !== undefined) { cond = 'attribute_exists(teamId) AND (#mc = :old OR attribute_not_exists(#mc))'; values[':old'] = old }
      await ddb.send(new UpdateCommand({
        TableName: T.teams, Key: { teamId },
        UpdateExpression: 'SET #mc = :n', ConditionExpression: cond,
        ExpressionAttributeNames: { '#mc': 'memberCount' }, ExpressionAttributeValues: values,
      }))
      memberCount = observed
    } catch (e) {
      if (!isCondFail(e)) console.warn('memberCount repair failed:', teamId, e?.name)
    }
  }
  members.sort((a, b) => (a.role === 'owner' ? 0 : 1) - (b.role === 'owner' ? 0 : 1) || (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''))
  const profiles = await loadUserProfiles(members.map(m => m.userId))
  const items = members.map(m => {
    const p = profiles.get(m.userId)
    return {
      userId: m.userId, name: p?.name ?? m.userName ?? 'メンバー', bio: p?.bio ?? '', iconUrl: p?.iconUrl ?? null,
      role: m.role, joinedAt: m.joinedAt,
    }
  })
  return { team: publicTeam(team, { memberCount }), myRole: me.role, items }
}

// 投稿者の「現在の」プロフィールアイコンを取得する（投稿時点の値を固定しないため、リクエストごとに結合する）。
// 重複を除いたuserIdごとにGetItemを並列実行（投稿数ではなく投稿者数に比例）。
// BatchGetItemはLambdaロールに未許可のため使わない。失敗してもアイコンなし扱いで投稿一覧は返す。
async function loadUserIcons(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]
  const entries = await Promise.all(ids.map(async id => {
    try {
      const { Item } = await ddb.send(new GetCommand({ TableName: T.users, Key: { userId: id }, ProjectionExpression: 'iconUrl' }))
      return [id, Item?.iconUrl ?? null]
    } catch (e) {
      console.warn('Icon lookup failed:', e)
      return [id, null]
    }
  }))
  return new Map(entries)
}

// カロリー計算に使う性別・年代（プロフィールが無ければ既定値）
async function loadCalorieProfile(userId) {
  let gender = 'other', ageGroup = '30s'
  const { Item: prof } = await ddb.send(new GetCommand({ TableName: T.users, Key: { userId } }))
  if (prof) { gender = prof.gender ?? 'other'; ageGroup = prof.ageGroup ?? '30s' }
  return { gender, ageGroup }
}

// 投稿一覧の各項目に likedByMe（自分のいいね有無）と投稿者の現在のアイコンURLを付ける
async function decoratePosts(items, userId) {
  const likedPostIds = new Set()
  const likeChecks = await Promise.all(items.map(async p => {
    const { Item } = await ddb.send(new GetCommand({ TableName: T.reactions, Key: { postId: p.postId, reactionId: `like#${userId}` }, ConsistentRead: true }))
    return Item ? p.postId : null
  }))
  likeChecks.forEach(id => { if (id) likedPostIds.add(id) })
  const icons = await loadUserIcons(items.map(p => p.userId))
  return items.map(p => ({ ...p, userIconUrl: icons.get(p.userId) ?? null, likedByMe: likedPostIds.has(p.postId) }))
}

async function createNotification(recipientId, type, actorId, actorName, postId, message) {
  if (recipientId === actorId) return
  await ddb.send(new PutCommand({
    TableName: T.notifications,
    Item: {
      userId: recipientId,
      notificationId: newId('notif'),
      type, actorId, actorName,
      postId: postId ?? null,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    },
  }))
}

exports.handler = async (event) => {
  const { routeKey, pathParameters = {}, requestContext } = event
  const claims = requestContext?.authorizer?.jwt?.claims ?? {}
  const userId = claims.sub
  const userName = claimUserName(claims)

  let body = {}
  if (event.body) {
    try { body = JSON.parse(event.body) } catch {}
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) body = {}

  try {
    if (routeKey === 'GET /uploads/presigned-url') {
      const folder = event.queryStringParameters?.folder ?? 'posts'
      const contentType = event.queryStringParameters?.contentType ?? 'image/jpeg'
      const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('webp') ? 'webp' : 'jpg'
      const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({ Bucket: UPLOAD_BUCKET, Key: filename, ContentType: contentType }),
        { expiresIn: 300 }
      )
      const imageUrl = `${UPLOAD_URL_BASE}${filename}`
      return ok({ uploadUrl, imageUrl })
    }

    if (routeKey === 'GET /posts') {
      const teamId = await requireTeamScope(event, userId)
      const { Items: posts = [] } = await ddb.send(new QueryCommand({
        TableName: T.posts, IndexName: 'teamId-createdAt-index',
        KeyConditionExpression: 'teamId = :t', ExpressionAttributeValues: { ':t': teamId },
        ScanIndexForward: false, Limit: 50,
      }))
      posts.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || (b.postId ?? '').localeCompare(a.postId ?? ''))
      const top = posts.slice(0, 50)
      return ok({ items: await decoratePosts(top, userId) })
    }

    if (routeKey === 'POST /posts') {
      const teamId = await requireTeamScope(event, userId)
      const { exerciseType, distance, duration, memo } = parsePostFields(body)
      const imageUrl = parseImageUrl(body.imageUrl)
      const { gender, ageGroup } = await loadCalorieProfile(userId)

      const calories = calcCalories(exerciseType, duration, gender, ageGroup)
      const post = {
        postId: newId('post'), teamId, userId, userName, type: 'record',
        exerciseType, distance, duration,
        calories, foodExample: foodExample(calories), memo,
        imageUrl,
        likeCount: 0, commentCount: 0, createdAt: new Date().toISOString(),
      }
      await ddb.send(new PutCommand({ TableName: T.posts, Item: post }))

      // 目標の自動更新
      try {
        const { Items: goals = [] } = await ddb.send(new QueryCommand({
          TableName: T.goals,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': userId },
        }))
        for (const goal of goals) {
          let increment = 0
          switch (goal.type) {
            case 'distance': increment = distance; break
            case 'duration': increment = duration; break
            case 'calories': increment = calories; break
            case 'count': increment = 1; break
          }
          if (increment > 0) {
            await ddb.send(new UpdateCommand({
              TableName: T.goals,
              Key: { userId, goalId: goal.goalId },
              UpdateExpression: 'ADD currentValue :n',
              ExpressionAttributeValues: { ':n': increment },
            }))
          }
        }
      } catch (e) {
        console.warn('Goal update failed:', e)
      }

      return created({ ...post, likedByMe: false })
    }

    if (routeKey === 'PUT /posts/{id}') {
      const postId = pathParameters.id
      const teamId = await requireTeamScope(event, userId)
      const post = await loadTeamPost(postId, teamId)
      if (!userId || post.userId !== userId) throw new HttpError(403, 'NOT_POST_OWNER')

      const merged = parsePostFields(body, {
        exerciseType: post.exerciseType, distance: post.distance, duration: post.duration, memo: post.memo ?? '',
      })
      const imageUrl = 'imageUrl' in body ? parseImageUrl(body.imageUrl) : (post.imageUrl ?? null)
      const { gender, ageGroup } = await loadCalorieProfile(userId)
      const calories = calcCalories(merged.exerciseType, merged.duration, gender, ageGroup)

      try {
        const { Attributes } = await ddb.send(new UpdateCommand({
          TableName: T.posts,
          Key: { postId },
          UpdateExpression: 'SET #et = :et, #d = :d, #du = :du, #m = :m, #img = :img, #c = :c, #f = :f, #ea = :ea',
          ConditionExpression: 'attribute_exists(#pid) AND #uid = :uid AND #tid = :tid',
          ExpressionAttributeNames: {
            '#et': 'exerciseType', '#d': 'distance', '#du': 'duration', '#m': 'memo', '#img': 'imageUrl',
            '#c': 'calories', '#f': 'foodExample', '#ea': 'editedAt',
            '#pid': 'postId', '#uid': 'userId', '#tid': 'teamId',
          },
          ExpressionAttributeValues: {
            ':et': merged.exerciseType, ':d': merged.distance, ':du': merged.duration, ':m': merged.memo,
            ':img': imageUrl, ':c': calories, ':f': foodExample(calories), ':ea': nowIso(),
            ':uid': userId, ':tid': teamId,
          },
          ReturnValues: 'ALL_NEW',
        }))
        return ok((await decoratePosts([Attributes], userId))[0])
      } catch (e) {
        if (!isCondFail(e)) throw e
        await loadTeamPost(postId, teamId)
        throw new HttpError(403, 'NOT_POST_OWNER')
      }
    }

    if (routeKey === 'POST /posts/{id}/likes') {
      const postId = pathParameters.id
      const teamId = await requireTeamScope(event, userId)
      const likedPost = await loadTeamPost(postId, teamId)
      const reactionId = `like#${userId}`
      const { Item: ex } = await ddb.send(new GetCommand({ TableName: T.reactions, Key: { postId, reactionId } }))
      if (ex) return ok({ liked: true })
      await ddb.send(new PutCommand({
        TableName: T.reactions,
        Item: { postId, reactionId, type: 'like', userId, createdAt: new Date().toISOString() },
      }))
      const { Attributes: p } = await ddb.send(new UpdateCommand({
        TableName: T.posts, Key: { postId },
        UpdateExpression: 'ADD likeCount :n',
        ExpressionAttributeValues: { ':n': 1 },
        ReturnValues: 'ALL_NEW',
      }))
      if (likedPost.userId && likedPost.userId !== userId && await isMember(likedPost.teamId, likedPost.userId)) {
        await createNotification(likedPost.userId, 'like', userId, userName, postId, `${userName}さんがいいねしました`)
      }
      return ok({ liked: true, likeCount: p?.likeCount ?? 1 })
    }

    if (routeKey === 'DELETE /posts/{id}/likes') {
      const postId = pathParameters.id
      const teamId = await requireTeamScope(event, userId)
      await loadTeamPost(postId, teamId)
      await ddb.send(new DeleteCommand({ TableName: T.reactions, Key: { postId, reactionId: `like#${userId}` } }))
      const { Attributes: p } = await ddb.send(new UpdateCommand({
        TableName: T.posts, Key: { postId },
        UpdateExpression: 'ADD likeCount :n',
        ExpressionAttributeValues: { ':n': -1 },
        ReturnValues: 'ALL_NEW',
      }))
      return ok({ liked: false, likeCount: Math.max(0, p?.likeCount ?? 0) })
    }

    if (routeKey === 'POST /posts/{id}/comments') {
      const postId = pathParameters.id
      const teamId = await requireTeamScope(event, userId)
      const commentedPost = await loadTeamPost(postId, teamId)
      const { content = '' } = body
      if (typeof content !== 'string' || !content.trim()) return badRequest('content is required')
      const ts = Date.now()
      const comment = {
        postId, reactionId: `comment#${ts}#${userId}`,
        type: 'comment', userId, userName, content: content.trim(),
        createdAt: new Date(ts).toISOString(),
      }
      await ddb.send(new PutCommand({ TableName: T.reactions, Item: comment }))
      await ddb.send(new UpdateCommand({
        TableName: T.posts, Key: { postId },
        UpdateExpression: 'ADD commentCount :n',
        ExpressionAttributeValues: { ':n': 1 },
      }))
      if (commentedPost.userId && commentedPost.userId !== userId && await isMember(commentedPost.teamId, commentedPost.userId)) {
        await createNotification(commentedPost.userId, 'comment', userId, userName, postId, `${userName}さんがコメントしました：${content.trim().slice(0, 30)}`)
      }
      return created(comment)
    }

    if (routeKey === 'GET /posts/{id}/comments') {
      const postId = pathParameters.id
      const teamId = await requireTeamScope(event, userId)
      await loadTeamPost(postId, teamId)
      const { Items = [] } = await ddb.send(new QueryCommand({
        TableName: T.reactions, ConsistentRead: true,
        KeyConditionExpression: 'postId = :pid AND begins_with(reactionId, :pfx)',
        ExpressionAttributeValues: { ':pid': postId, ':pfx': 'comment#' },
      }))
      Items.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
      return ok({ items: Items })
    }

    if (routeKey === 'GET /goals') {
      const { Items = [] } = await ddb.send(new QueryCommand({
        TableName: T.goals,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      }))
      return ok({ items: Items })
    }

    if (routeKey === 'POST /goals') {
      const { type = 'distance', period = 'monthly', targetValue = 0 } = body
      const goal = {
        userId, goalId: newId('goal'), type, period,
        targetValue: Number(targetValue), currentValue: 0,
        createdAt: new Date().toISOString(),
      }
      await ddb.send(new PutCommand({ TableName: T.goals, Item: goal }))
      return created(goal)
    }

    if (routeKey === 'PUT /goals/{goalId}') {
      const { goalId } = pathParameters
      const sets = [], vals = {}
      if (body.targetValue !== undefined) { sets.push('targetValue = :tv'); vals[':tv'] = Number(body.targetValue) }
      if (body.currentValue !== undefined) { sets.push('currentValue = :cv'); vals[':cv'] = Number(body.currentValue) }
      if (!sets.length) return ok({})
      const { Attributes: updated } = await ddb.send(new UpdateCommand({
        TableName: T.goals, Key: { userId, goalId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeValues: vals,
        ReturnValues: 'ALL_NEW',
      }))
      return ok(updated)
    }

    if (routeKey === 'DELETE /goals/{goalId}') {
      await ddb.send(new DeleteCommand({ TableName: T.goals, Key: { userId, goalId: pathParameters.goalId } }))
      return noContent()
    }

    if (routeKey === 'GET /me') {
      return ok(await ensureProfile(userId, claims))
    }

    if (routeKey === 'PUT /me') {
      const sets = ['updatedAt = :ua'], vals = { ':ua': new Date().toISOString() }
      if (body.bio !== undefined) { sets.push('bio = :bio'); vals[':bio'] = body.bio }
      if (body.gender !== undefined) { sets.push('gender = :gender'); vals[':gender'] = body.gender }
      if (body.ageGroup !== undefined) { sets.push('ageGroup = :ageGroup'); vals[':ageGroup'] = body.ageGroup }
      if (body.iconUrl !== undefined) { sets.push('iconUrl = :iconUrl'); vals[':iconUrl'] = body.iconUrl }
      const { Attributes: updated } = await ddb.send(new UpdateCommand({
        TableName: T.users, Key: { userId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeValues: vals,
        ReturnValues: 'ALL_NEW',
      }))
      return ok(updated)
    }

    if (routeKey === 'GET /members') {
      const teamId = getTeamId(event)
      const view = await loadTeamMembersView(teamId, userId)
      return ok({ items: view.items })
    }

    if (routeKey === 'GET /members/{userId}') {
      const teamId = await requireTeamScope(event, userId)
      if (!(await isMember(teamId, pathParameters.userId))) return notFound('Member not found')
      const { Item: member } = await ddb.send(new GetCommand({
        TableName: T.users, Key: { userId: pathParameters.userId }
      }))
      if (!member) return notFound('Member not found')
      // 他チームへの投稿が多いと、このチームの投稿が最新50件から押し出されて少なく見える（既知の制限）
      const { Items: posts = [] } = await ddb.send(new QueryCommand({
        TableName: T.posts,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': pathParameters.userId },
        Limit: 50, ScanIndexForward: false,
      }))
      const recentPosts = posts.filter(p => p.teamId === teamId).slice(0, 10)
      return ok({ userId: member.userId, name: member.name, bio: member.bio, iconUrl: member.iconUrl, recentPosts })
    }

    // GET /places/search - Google Places Text Search proxy
    if (routeKey === 'GET /places/search') {
      const params = event.queryStringParameters ?? {}
      const q = params.q ?? ''
      const lat = params.lat ?? '35.6762'
      const lng = params.lng ?? '139.6503'
      const radius = params.radius ?? '3000'
      if (!q) return badRequest('q is required')
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
      url.searchParams.set('query', q)
      url.searchParams.set('location', `${lat},${lng}`)
      url.searchParams.set('radius', radius)
      url.searchParams.set('key', process.env.GOOGLE_PLACES_KEY ?? '')
      url.searchParams.set('language', 'ja')
      const res = await fetch(url.toString())
      const data = await res.json()
      const items = (data.results ?? []).slice(0, 10).map(p => ({
        placeId: p.place_id,
        name: p.name,
        address: p.formatted_address,
        lat: p.geometry?.location?.lat,
        lng: p.geometry?.location?.lng,
        rating: p.rating,
      }))
      return ok({ items, status: data.status })
    }

    // POST /ai/suggest - Bedrock Claude Haiku AI course/restaurant suggestion
    if (routeKey === 'POST /ai/suggest') {
      const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime')
      const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-1' })
      const { mode = 'restaurant', restaurant, exerciseType = 'running', distance = 5, duration = 30 } = body
      let prompt
      if (mode === 'restaurant') {
        prompt = `あなたはウォーキング・ランニングコースの専門家です。
目的地のレストランに向かうコースを提案してください。

- 目的地: ${restaurant?.name ?? ''}（${restaurant?.address ?? ''}）
- 運動種別: ${exerciseType === 'running' ? 'ランニング' : 'ウォーキング'}
- 希望距離: ${distance}km

200文字以内で、コースの特徴（景観、難易度、見どころ）を具体的に提案してください。`
      } else {
        const kcal = Math.round(7.0 * 65 * Number(duration) / 60)
        prompt = `あなたはグルメガイドの専門家です。
運動後のご褒美グルメを提案してください。

- 消費カロリー: ${kcal}kcal
- 運動種別: ${exerciseType === 'running' ? 'ランニング' : 'ウォーキング'}
- 距離: ${distance}km・時間: ${duration}分

消費カロリーに見合ったおすすめの料理ジャンルを3つ提案してください。
各ジャンルを「・ジャンル名：理由」の形式で、合計150文字以内で。`
      }
      const response = await bedrockClient.send(new ConverseCommand({
        modelId: 'jp.anthropic.claude-haiku-3-5',
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 300, temperature: 0.7 },
      }))
      const suggestion = response.output.message.content[0].text
      return ok({ suggestion })
    }

    // POST /posts/{id}/join - join a plan
    if (routeKey === 'POST /posts/{id}/join') {
      const postId = pathParameters.id
      const teamId = await requireTeamScope(event, userId)
      const planPost = await loadTeamPost(postId, teamId)
      const { exerciseType: joinType = 'walking' } = body
      const reactionId = `join#${userId}`
      await ddb.send(new PutCommand({
        TableName: T.reactions,
        Item: { postId, reactionId, type: 'join', userId, userName, exerciseType: joinType, createdAt: new Date().toISOString() },
      }))
      const { Attributes: p } = await ddb.send(new UpdateCommand({
        TableName: T.posts, Key: { postId },
        UpdateExpression: 'ADD participantCount :n',
        ExpressionAttributeValues: { ':n': 1 },
        ReturnValues: 'ALL_NEW',
      }))
      if (planPost.userId && planPost.userId !== userId && await isMember(planPost.teamId, planPost.userId)) {
        await createNotification(planPost.userId, 'join', userId, userName, postId, `${userName}さんがプランに参加します`)
      }
      return ok({ joined: true, participantCount: p?.participantCount ?? 1 })
    }

    // DELETE /posts/{id}/join - leave a plan
    if (routeKey === 'DELETE /posts/{id}/join') {
      const postId = pathParameters.id
      const teamId = await requireTeamScope(event, userId)
      await loadTeamPost(postId, teamId)
      await ddb.send(new DeleteCommand({ TableName: T.reactions, Key: { postId, reactionId: `join#${userId}` } }))
      const { Attributes: p } = await ddb.send(new UpdateCommand({
        TableName: T.posts, Key: { postId },
        UpdateExpression: 'ADD participantCount :n',
        ExpressionAttributeValues: { ':n': -1 },
        ReturnValues: 'ALL_NEW',
      }))
      return ok({ joined: false, participantCount: Math.max(0, p?.participantCount ?? 0) })
    }

    // GET /posts/{id}/participants - list plan participants
    if (routeKey === 'GET /posts/{id}/participants') {
      const postId = pathParameters.id
      const teamId = await requireTeamScope(event, userId)
      await loadTeamPost(postId, teamId)
      const { Items = [] } = await ddb.send(new QueryCommand({
        TableName: T.reactions,
        KeyConditionExpression: 'postId = :pid AND begins_with(reactionId, :pfx)',
        ExpressionAttributeValues: { ':pid': postId, ':pfx': 'join#' },
      }))
      return ok({ items: Items })
    }

    // GET /events - イベント一覧
    if (routeKey === 'GET /events') {
      const teamId = await requireTeamScope(event, userId)
      const { items: Items } = await scanAll({
        TableName: T.events, FilterExpression: 'teamId = :t', ExpressionAttributeValues: { ':t': teamId },
      })
      Items.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      return ok({ items: Items })
    }

    // POST /events - イベント作成
    if (routeKey === 'POST /events') {
      const teamId = await requireTeamScope(event, userId)
      const { title, description = '', date, time = '', location = '', restaurantName = '', walkingRoute = '', runningRoute = '' } = body
      if (!title || !date) return badRequest('title and date are required')
      const newEvent = {
        eventId: newId('event'), teamId,
        title, description, date, time, location,
        restaurantName, walkingRoute, runningRoute,
        createdBy: userId, createdByName: userName,
        participantCount: 0,
        createdAt: new Date().toISOString(),
      }
      await ddb.send(new PutCommand({ TableName: T.events, Item: newEvent }))
      return created(newEvent)
    }

    // GET /events/{eventId} - イベント詳細
    if (routeKey === 'GET /events/{eventId}') {
      const { eventId } = pathParameters
      const teamId = await requireTeamScope(event, userId)
      const teamEvent = await loadTeamEvent(eventId, teamId)
      const { Items: participants = [] } = await ddb.send(new QueryCommand({
        TableName: T.participants,
        KeyConditionExpression: 'eventId = :eid',
        ExpressionAttributeValues: { ':eid': eventId },
      }))
      const myParticipation = participants.find(p => p.userId === userId)
      return ok({ ...teamEvent, participants, joinedByMe: !!myParticipation, myExerciseType: myParticipation?.exerciseType })
    }

    // POST /events/{eventId}/participants - イベント参加
    if (routeKey === 'POST /events/{eventId}/participants') {
      const { eventId } = pathParameters
      const teamId = await requireTeamScope(event, userId)
      await loadTeamEvent(eventId, teamId)
      const { exerciseType = 'walking' } = body
      await ddb.send(new PutCommand({
        TableName: T.participants,
        Item: { eventId, userId, userName, exerciseType, createdAt: new Date().toISOString() },
      }))
      const { Attributes: updated } = await ddb.send(new UpdateCommand({
        TableName: T.events, Key: { eventId },
        UpdateExpression: 'ADD participantCount :n',
        ExpressionAttributeValues: { ':n': 1 },
        ReturnValues: 'ALL_NEW',
      }))
      return ok({ joined: true, participantCount: updated?.participantCount ?? 1 })
    }

    // DELETE /events/{eventId}/participants - イベント参加取消
    if (routeKey === 'DELETE /events/{eventId}/participants') {
      const { eventId } = pathParameters
      const teamId = await requireTeamScope(event, userId)
      await loadTeamEvent(eventId, teamId)
      await ddb.send(new DeleteCommand({ TableName: T.participants, Key: { eventId, userId } }))
      const { Attributes: updated } = await ddb.send(new UpdateCommand({
        TableName: T.events, Key: { eventId },
        UpdateExpression: 'ADD participantCount :n',
        ExpressionAttributeValues: { ':n': -1 },
        ReturnValues: 'ALL_NEW',
      }))
      return ok({ joined: false, participantCount: Math.max(0, updated?.participantCount ?? 0) })
    }

    // GET /notifications - 通知一覧
    if (routeKey === 'GET /notifications') {
      const { Items = [] } = await ddb.send(new QueryCommand({
        TableName: T.notifications,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
        Limit: 30,
      }))
      Items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      const unreadCount = Items.filter(n => !n.read).length
      return ok({ items: Items, unreadCount })
    }

    // PUT /notifications/read-all - 全既読
    if (routeKey === 'PUT /notifications/read-all') {
      const { Items = [] } = await ddb.send(new QueryCommand({
        TableName: T.notifications,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      }))
      const unread = Items.filter(n => !n.read)
      for (const n of unread) {
        await ddb.send(new UpdateCommand({
          TableName: T.notifications,
          Key: { userId: n.userId, notificationId: n.notificationId },
          UpdateExpression: 'SET #r = :t',
          ExpressionAttributeNames: { '#r': 'read' },
          ExpressionAttributeValues: { ':t': true },
        }))
      }
      return ok({ updated: unread.length })
    }

    // ---- チーム ----

    // GET /teams - チーム一覧（全ログインユーザー。合言葉関連の属性は読み取らない）
    if (routeKey === 'GET /teams') {
      let q = event.queryStringParameters?.q ?? ''
      try { q = decodeURIComponent(q) } catch {}
      q = [...q.normalize('NFKC').toLowerCase().trim()].slice(0, 50).join('')
      const { items: all } = await scanAll({ TableName: T.teams, ...TEAM_PUBLIC_READ })
      const joinedIds = new Set((await listMemberships(userId)).map(m => m.teamId))
      let teams = all
      if (q) teams = teams.filter(t => (t.name ?? '').normalize('NFKC').toLowerCase().includes(q))
      const items = teams.map(t => publicTeam(t, { joined: joinedIds.has(t.teamId) }))
      items.sort((a, b) => (b.joined - a.joined) || (b.memberCount - a.memberCount) || (a.name ?? '').localeCompare(b.name ?? '', 'ja'))
      return ok({ items: items.slice(0, 200), truncated: items.length > 200 })
    }

    // POST /teams - チーム作成
    if (routeKey === 'POST /teams') {
      const name = parseTeamName(body.name)
      const pass = parsePassphrase(body.passphrase)
      await reserveAttempt(`c#${userId}`, 5, HOUR_MS, 'CREATE_LOCKED')
      await ensureProfile(userId, claims)
      if ((await listMemberships(userId)).length >= MAX_TEAMS_PER_USER) throw new HttpError(409, 'TOO_MANY_TEAMS')
      const { hash, salt, kdf } = await hashPassphrase(pass)
      const joinedAt = nowIso()
      const team = {
        teamId: newId('team'), name,
        passphraseHash: hash, passphraseSalt: salt, passphraseKdf: kdf,
        createdBy: userId, createdByName: userName, createdAt: joinedAt, memberCount: 1,
      }
      await ddb.send(new PutCommand({ TableName: T.teams, Item: team, ConditionExpression: 'attribute_not_exists(teamId)' }))
      try {
        await ddb.send(new PutCommand({
          TableName: T.teamMembers,
          Item: { teamId: team.teamId, userId, role: 'owner', joinedAt, userName },
          ConditionExpression: 'attribute_not_exists(teamId)',
        }))
      } catch (e) {
        try {
          await ddb.send(new DeleteCommand({ TableName: T.teams, Key: { teamId: team.teamId } }))
        } catch (e2) {
          console.error('Team rollback failed (orphan team):', team.teamId, e2?.name)
        }
        throw e
      }
      await setLastTeamBestEffort(userId, team.teamId)
      return created({ team: publicTeam(team, { role: 'owner', joinedAt }) })
    }

    // POST /teams/{teamId}/join - 合言葉で参加
    if (routeKey === 'POST /teams/{teamId}/join') {
      const teamId = checkTeamId(pathParameters.teamId)
      const pass = parsePassphrase(body.passphrase)
      const { Item: team } = await ddb.send(new GetCommand({ TableName: T.teams, Key: { teamId }, ConsistentRead: true }))
      if (!team) throw new HttpError(404, 'TEAM_NOT_FOUND')
      const existing = await getMembership(teamId, userId)
      if (existing) return ok({ team: publicTeam(team, { role: existing.role, joinedAt: existing.joinedAt }), alreadyMember: true })
      if ((await listMemberships(userId)).length >= MAX_TEAMS_PER_USER) throw new HttpError(409, 'TOO_MANY_TEAMS')
      const attempts = await reserveAttempt(`t#${teamId}#${userId}`, 5, JOIN_WINDOW_MS, 'JOIN_LOCKED')
      await reserveAttempt(`u#${userId}`, 20, JOIN_WINDOW_MS, 'JOIN_LOCKED')
      const matched = await verifyPassphrase(pass, { hash: team.passphraseHash, salt: team.passphraseSalt, kdf: team.passphraseKdf })
      if (!matched) {
        console.warn('Join rejected: invalid passphrase', userId, teamId)
        throw new HttpError(403, 'INVALID_PASSPHRASE', { remainingAttempts: Math.max(0, 5 - attempts) })
      }
      if ((team.memberCount ?? 0) >= MAX_TEAM_MEMBERS) throw new HttpError(409, 'TEAM_FULL')
      const joinedAt = nowIso()
      try {
        await ddb.send(new PutCommand({
          TableName: T.teamMembers,
          Item: { teamId, userId, role: 'member', joinedAt, userName },
          ConditionExpression: 'attribute_not_exists(teamId)',
        }))
      } catch (e) {
        if (!isCondFail(e)) throw e
        // 同時参加で先に入った
        const m = await getMembership(teamId, userId)
        return ok({ team: publicTeam(team, { role: m?.role ?? 'member', joinedAt: m?.joinedAt ?? joinedAt }), alreadyMember: true })
      }
      let memberCount
      try {
        const { Attributes } = await ddb.send(new UpdateCommand({
          TableName: T.teams, Key: { teamId },
          UpdateExpression: 'ADD memberCount :one', ConditionExpression: 'attribute_exists(teamId)',
          ExpressionAttributeValues: { ':one': 1 }, ReturnValues: 'UPDATED_NEW',
        }))
        memberCount = Attributes?.memberCount
      } catch (e) {
        if (!isCondFail(e)) throw e
        // 参加の直前にチームが消えた: メンバー項目を巻き戻す
        await ddb.send(new DeleteCommand({ TableName: T.teamMembers, Key: { teamId, userId } })).catch(() => {})
        throw new HttpError(404, 'TEAM_NOT_FOUND')
      }
      await ddb.send(new DeleteCommand({ TableName: T.teamAttempts, Key: { attemptKey: `t#${teamId}#${userId}` } })).catch(e => console.warn('Attempt reset failed:', e?.name))
      try {
        await ensureProfile(userId, claims)
        await setLastTeam(userId, teamId)
      } catch (e) {
        console.warn('Last team update failed:', userId, teamId, e?.name)
      }
      return ok({ team: publicTeam(team, { memberCount: memberCount ?? (team.memberCount ?? 0) + 1, role: 'member', joinedAt }), alreadyMember: false })
    }

    // GET /me/teams - 自分のチーム一覧と最後に選んだチーム
    if (routeKey === 'GET /me/teams') {
      const prof = await ensureProfile(userId, claims)
      const memberships = await listMemberships(userId)
      const rows = await Promise.all(memberships.map(async m => {
        const t = await getTeamPublic(m.teamId)
        return t ? { ...publicTeam(t), role: m.role, joinedAt: m.joinedAt } : null
      }))
      const items = rows.filter(Boolean).sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''))
      return ok({ items, lastTeamId: prof.lastTeamId ?? null, lastTeamAt: prof.lastTeamAt ?? null })
    }

    // PUT /me/last-team - 最後に選んだチームを保存
    if (routeKey === 'PUT /me/last-team') {
      const teamId = checkTeamId(body.teamId)
      await requireMember(teamId, userId)
      await ensureProfile(userId, claims)
      const lastTeamAt = await setLastTeam(userId, teamId)
      return ok({ lastTeamId: teamId, lastTeamAt })
    }

    // GET /teams/{teamId}/members - メンバー一覧
    if (routeKey === 'GET /teams/{teamId}/members') {
      const teamId = checkTeamId(pathParameters.teamId)
      return ok(await loadTeamMembersView(teamId, userId))
    }

    // DELETE /teams/{teamId}/members/me - 脱退（TransactWriteItems が使えないため、失敗しても無人・オーナー不在にならない順序で行う）
    if (routeKey === 'DELETE /teams/{teamId}/members/me') {
      const teamId = checkTeamId(pathParameters.teamId)
      const me = await requireMember(teamId, userId)
      const others = (await listTeamMembers(teamId)).filter(m => m.userId !== userId)
      if (!others.length) throw new HttpError(409, 'LAST_MEMBER')
      if (me.role === 'owner' && !others.some(m => m.role === 'owner')) {
        others.sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? '') || a.userId.localeCompare(b.userId))
        let promoted = false
        for (const c of others.slice(0, 3)) {
          try {
            await ddb.send(new UpdateCommand({
              TableName: T.teamMembers, Key: { teamId, userId: c.userId },
              UpdateExpression: 'SET #r = :owner',
              ConditionExpression: 'attribute_exists(teamId) AND attribute_exists(userId)',
              ExpressionAttributeNames: { '#r': 'role' }, ExpressionAttributeValues: { ':owner': 'owner' },
            }))
            promoted = true
            break
          } catch (e) {
            if (!isCondFail(e)) throw e
          }
        }
        if (!promoted) throw new HttpError(409, 'RETRY')
      }
      try {
        await ddb.send(new UpdateCommand({
          TableName: T.teams, Key: { teamId },
          UpdateExpression: 'ADD memberCount :neg',
          ConditionExpression: 'attribute_exists(teamId) AND memberCount > :one',
          ExpressionAttributeValues: { ':neg': -1, ':one': 1 },
        }))
      } catch (e) {
        if (isCondFail(e)) throw new HttpError(409, 'LAST_MEMBER')
        throw e
      }
      try {
        await ddb.send(new DeleteCommand({ TableName: T.teamMembers, Key: { teamId, userId }, ConditionExpression: 'attribute_exists(teamId)' }))
      } catch (e) {
        if (!isCondFail(e)) throw e
        // 二重送信で既に削除済み: 手順4の減算を戻す
        await ddb.send(new UpdateCommand({
          TableName: T.teams, Key: { teamId }, UpdateExpression: 'ADD memberCount :one',
          ConditionExpression: 'attribute_exists(teamId)', ExpressionAttributeValues: { ':one': 1 },
        })).catch(e2 => console.warn('memberCount correction failed:', teamId, e2?.name))
      }
      try {
        await ddb.send(new UpdateCommand({
          TableName: T.users, Key: { userId },
          UpdateExpression: 'REMOVE lastTeamId, lastTeamAt', ConditionExpression: 'lastTeamId = :t',
          ExpressionAttributeValues: { ':t': teamId },
        }))
      } catch (e) {
        if (!isCondFail(e)) console.warn('Last team clear failed:', userId, teamId, e?.name)
      }
      return noContent()
    }

    // PUT /teams/{teamId}/passphrase - 合言葉の変更（オーナーのみ）
    if (routeKey === 'PUT /teams/{teamId}/passphrase') {
      const teamId = checkTeamId(pathParameters.teamId)
      const me = await requireMember(teamId, userId)
      if (me.role !== 'owner') throw new HttpError(403, 'OWNER_ONLY')
      const pass = parsePassphrase(body.passphrase)
      await reserveAttempt(`p#${userId}`, 10, HOUR_MS, 'CHANGE_LOCKED')
      const { hash, salt, kdf } = await hashPassphrase(pass)
      try {
        await ddb.send(new UpdateCommand({
          TableName: T.teams, Key: { teamId },
          UpdateExpression: 'SET #h = :h, #s = :s, #k = :k, #u = :u',
          ConditionExpression: 'attribute_exists(teamId)',
          ExpressionAttributeNames: { '#h': 'passphraseHash', '#s': 'passphraseSalt', '#k': 'passphraseKdf', '#u': 'passphraseUpdatedAt' },
          ExpressionAttributeValues: { ':h': hash, ':s': salt, ':k': kdf, ':u': nowIso() },
        }))
      } catch (e) {
        if (isCondFail(e)) throw new HttpError(404, 'TEAM_NOT_FOUND')
        throw e
      }
      return noContent()
    }

    return notFound()
  } catch (err) {
    if (err instanceof HttpError) return r(err.status, { error: err.message, code: err.code, ...err.extra })
    console.error('Handler error:', err)
    return serverError()
  }
}
