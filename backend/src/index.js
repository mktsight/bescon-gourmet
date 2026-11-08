'use strict'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
// 署名付きURLに空ボディのCRC32が含まれ、実ファイルのPUTがBadDigestで失敗するのを防ぐ
const s3Client = new S3Client({ region: 'ap-northeast-1', requestChecksumCalculation: 'WHEN_REQUIRED' })
const UPLOAD_BUCKET = 'bescon-gourmet-uploads-897729110502'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-1' }))

const T = {
  users: 'bescon-users',
  posts: 'bescon-posts',
  goals: 'bescon-goals',
  reactions: 'bescon-reactions',
  notifications: 'bescon-notifications',
  events: 'bescon-events',
  participants: 'bescon-participants',
}

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

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
const r = (s, b) => ({ statusCode: s, headers: CORS, body: JSON.stringify(b) })
const ok = b => r(200, b)
const created = b => r(201, b)
const noContent = () => ({ statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' })
const notFound = m => r(404, { error: m ?? 'Not found' })
const badRequest = m => r(400, { error: m ?? 'Bad request' })
const serverError = () => r(500, { error: 'Internal server error' })

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
  const userName = claims.name ?? (claims.email ?? '').split('@')[0] ?? 'メンバー'

  let body = {}
  if (event.body) {
    try { body = JSON.parse(event.body) } catch {}
  }

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
      const imageUrl = `https://${UPLOAD_BUCKET}.s3.ap-northeast-1.amazonaws.com/${filename}`
      return ok({ uploadUrl, imageUrl })
    }

    if (routeKey === 'GET /posts') {
      const { Items: posts = [] } = await ddb.send(new ScanCommand({ TableName: T.posts }))
      posts.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      const top = posts.slice(0, 50)

      const likedPostIds = new Set()
      if (userId) {
        const { Items: likes = [] } = await ddb.send(new ScanCommand({
          TableName: T.reactions,
          FilterExpression: 'userId = :uid AND #t = :type',
          ExpressionAttributeNames: { '#t': 'type' },
          ExpressionAttributeValues: { ':uid': userId, ':type': 'like' },
        }))
        likes.forEach(l => likedPostIds.add(l.postId))
      }
      const icons = await loadUserIcons(top.map(p => p.userId))
      return ok({ items: top.map(p => ({ ...p, userIconUrl: icons.get(p.userId) ?? null, likedByMe: likedPostIds.has(p.postId) })) })
    }

    if (routeKey === 'POST /posts') {
      const { exerciseType = 'walking', distance = 0, duration = 0, memo = '', imageUrl = null } = body
      let gender = 'other', ageGroup = '30s'
      const { Item: prof } = await ddb.send(new GetCommand({ TableName: T.users, Key: { userId } }))
      if (prof) { gender = prof.gender ?? 'other'; ageGroup = prof.ageGroup ?? '30s' }

      const calories = calcCalories(exerciseType, Number(duration), gender, ageGroup)
      const post = {
        postId: newId('post'), userId, userName, type: 'record',
        exerciseType, distance: Number(distance), duration: Number(duration),
        calories, foodExample: foodExample(calories), memo,
        imageUrl: imageUrl || null,
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
            case 'distance': increment = Number(distance); break
            case 'duration': increment = Number(duration); break
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

    if (routeKey === 'POST /posts/{id}/likes') {
      const postId = pathParameters.id
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
      const { Item: likedPost } = await ddb.send(new GetCommand({ TableName: T.posts, Key: { postId } }))
      if (likedPost?.userId) {
        await createNotification(likedPost.userId, 'like', userId, userName, postId, `${userName}さんがいいねしました`)
      }
      return ok({ liked: true, likeCount: p?.likeCount ?? 1 })
    }

    if (routeKey === 'DELETE /posts/{id}/likes') {
      const postId = pathParameters.id
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
      const { content = '' } = body
      if (!content.trim()) return badRequest('content is required')
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
      const { Item: commentedPost } = await ddb.send(new GetCommand({ TableName: T.posts, Key: { postId } }))
      if (commentedPost?.userId) {
        await createNotification(commentedPost.userId, 'comment', userId, userName, postId, `${userName}さんがコメントしました：${content.trim().slice(0, 30)}`)
      }
      return created(comment)
    }

    if (routeKey === 'GET /posts/{id}/comments') {
      const postId = pathParameters.id
      const { Items = [] } = await ddb.send(new QueryCommand({
        TableName: T.reactions,
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
      let { Item: prof } = await ddb.send(new GetCommand({ TableName: T.users, Key: { userId } }))
      if (!prof) {
        prof = {
          userId, name: userName, email: claims.email ?? '', bio: '',
          gender: claims['custom:gender'] ?? 'other',
          ageGroup: claims['custom:agegroup'] ?? '30s',
          iconUrl: null, createdAt: new Date().toISOString(),
        }
        await ddb.send(new PutCommand({ TableName: T.users, Item: prof }))
      }
      return ok(prof)
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
      const { Items = [] } = await ddb.send(new ScanCommand({ TableName: T.users }))
      return ok({ items: Items.map(u => ({ userId: u.userId, name: u.name, bio: u.bio, iconUrl: u.iconUrl })) })
    }

    if (routeKey === 'GET /members/{userId}') {
      const { Item: member } = await ddb.send(new GetCommand({
        TableName: T.users, Key: { userId: pathParameters.userId }
      }))
      if (!member) return notFound('Member not found')
      const { Items: posts = [] } = await ddb.send(new QueryCommand({
        TableName: T.posts,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': pathParameters.userId },
        Limit: 10, ScanIndexForward: false,
      }))
      return ok({ userId: member.userId, name: member.name, bio: member.bio, iconUrl: member.iconUrl, recentPosts: posts })
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
      const { Item: planPost } = await ddb.send(new GetCommand({ TableName: T.posts, Key: { postId } }))
      if (planPost?.userId) {
        await createNotification(planPost.userId, 'join', userId, userName, postId, `${userName}さんがプランに参加します`)
      }
      return ok({ joined: true, participantCount: p?.participantCount ?? 1 })
    }

    // DELETE /posts/{id}/join - leave a plan
    if (routeKey === 'DELETE /posts/{id}/join') {
      const postId = pathParameters.id
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
      const { Items = [] } = await ddb.send(new QueryCommand({
        TableName: T.reactions,
        KeyConditionExpression: 'postId = :pid AND begins_with(reactionId, :pfx)',
        ExpressionAttributeValues: { ':pid': postId, ':pfx': 'join#' },
      }))
      return ok({ items: Items })
    }

    // GET /events - イベント一覧
    if (routeKey === 'GET /events') {
      const { Items = [] } = await ddb.send(new ScanCommand({ TableName: T.events }))
      Items.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      return ok({ items: Items })
    }

    // POST /events - イベント作成
    if (routeKey === 'POST /events') {
      const { title, description = '', date, time = '', location = '', restaurantName = '', walkingRoute = '', runningRoute = '' } = body
      if (!title || !date) return badRequest('title and date are required')
      const event = {
        eventId: newId('event'),
        title, description, date, time, location,
        restaurantName, walkingRoute, runningRoute,
        createdBy: userId, createdByName: userName,
        participantCount: 0,
        createdAt: new Date().toISOString(),
      }
      await ddb.send(new PutCommand({ TableName: T.events, Item: event }))
      return created(event)
    }

    // GET /events/{eventId} - イベント詳細
    if (routeKey === 'GET /events/{eventId}') {
      const { eventId } = pathParameters
      const { Item: event } = await ddb.send(new GetCommand({ TableName: T.events, Key: { eventId } }))
      if (!event) return notFound('Event not found')
      const { Items: participants = [] } = await ddb.send(new QueryCommand({
        TableName: T.participants,
        KeyConditionExpression: 'eventId = :eid',
        ExpressionAttributeValues: { ':eid': eventId },
      }))
      const myParticipation = participants.find(p => p.userId === userId)
      return ok({ ...event, participants, joinedByMe: !!myParticipation, myExerciseType: myParticipation?.exerciseType })
    }

    // POST /events/{eventId}/participants - イベント参加
    if (routeKey === 'POST /events/{eventId}/participants') {
      const { eventId } = pathParameters
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

    return notFound()
  } catch (err) {
    console.error('Handler error:', err)
    return serverError()
  }
}
