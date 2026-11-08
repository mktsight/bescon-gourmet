'use strict'
// 既存データを既定チームへ移行する（冪等。既定は dry-run、--apply を付けたときだけ書き込む）
//
// 使い方（合言葉は環境変数だけで渡す。引数やコマンド履歴に残さないこと）:
//   node backend/migrations/001-default-team.js                  # dry-run
//   read -rs BESCON_DEFAULT_TEAM_PASSPHRASE; export BESCON_DEFAULT_TEAM_PASSPHRASE
//   node backend/migrations/001-default-team.js --apply
//   unset BESCON_DEFAULT_TEAM_PASSPHRASE
// オプション: --apply --yes --team-id --team-name --owner-user-id --region
const path = require('path')
const readline = require('readline')
const { createRequire } = require('module')
const { normalizePassphrase, hashPassphrase, PassphraseError } = require('../src/passphrase')

const PASSPHRASE_ENV = 'BESCON_DEFAULT_TEAM_PASSPHRASE'
const TABLE = {
  teams: 'bescon-teams',
  teamMembers: 'bescon-team-members',
  users: 'bescon-users',
  posts: 'bescon-posts',
  events: 'bescon-events',
}
const TEAM_ID_RE = /^team_[A-Za-z0-9_]{1,64}$/

function parseArgs(argv) {
  const opts = {
    apply: false, yes: false, teamId: 'team_default_bescon', teamName: 'ベスコングルメ部',
    ownerUserId: null, region: 'ap-northeast-1',
  }
  const valued = { '--team-id': 'teamId', '--team-name': 'teamName', '--owner-user-id': 'ownerUserId', '--region': 'region' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    // 値を含み得る引数をそのまま表示しない（誤って合言葉を渡された場合の漏えい防止）
    const flag = String(arg).split('=')[0]
    if (arg === '--apply') opts.apply = true
    else if (arg === '--yes') opts.yes = true
    else if (arg.startsWith('--') && valued[flag]) {
      let value
      if (arg.includes('=')) value = arg.slice(flag.length + 1)
      else value = argv[++i]
      if (typeof value !== 'string' || value === '' || value.startsWith('--')) return { error: `${flag} には値が必要です` }
      opts[valued[flag]] = value
    } else {
      return { error: `不明なオプションです: ${arg.startsWith('--') ? flag : '(位置引数)'}` }
    }
  }
  return { opts }
}

const codePoints = s => [...s].length

function validateOpts(opts) {
  if (!TEAM_ID_RE.test(opts.teamId)) return '--team-id の形式が不正です（team_ で始まる英数字とアンダースコア）'
  opts.teamName = opts.teamName.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (codePoints(opts.teamName) < 1 || codePoints(opts.teamName) > 30) return '--team-name は1〜30文字で指定してください'
  return null
}

async function scanAll(ddb, ScanCommand, params) {
  const items = []
  let key
  do {
    const res = await ddb.send(new ScanCommand({ ...params, ExclusiveStartKey: key }))
    items.push(...(res.Items ?? []))
    key = res.LastEvaluatedKey
  } while (key)
  return items
}

async function queryMembers(ddb, QueryCommand, teamId, projection) {
  const items = []
  let key
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE.teamMembers,
      KeyConditionExpression: 'teamId = :t',
      ExpressionAttributeValues: { ':t': teamId },
      ProjectionExpression: projection.expr,
      ...(projection.names ? { ExpressionAttributeNames: projection.names } : {}),
      ConsistentRead: true,
      ExclusiveStartKey: key,
    }))
    items.push(...(res.Items ?? []))
    key = res.LastEvaluatedKey
  } while (key)
  return items
}

function askLine(stdin, log, question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: stdin })
    let done = false
    const finish = answer => {
      if (done) return
      done = true
      rl.close()
      resolve(answer)
    }
    rl.once('line', line => finish(line.trim()))
    rl.once('close', () => finish(''))
    log(question)
  })
}

// 条件付き書き込みを実行する。ConditionalCheckFailedException は失敗ではなく「条件不成立」として数える
async function conditional(stat, fn) {
  try {
    await fn()
    stat.done++
  } catch (err) {
    if (err && err.name === 'ConditionalCheckFailedException') stat.skipped++
    else throw err
  }
}

async function main(argv, io = {}) {
  const log = io.log ?? (line => console.log(line))
  const env = io.env ?? process.env
  const stdin = io.stdin ?? process.stdin

  const parsed = parseArgs(argv)
  if (parsed.error) {
    log(`エラー: ${parsed.error}`)
    log(`使い方: node backend/migrations/001-default-team.js [--apply] [--yes] [--team-id ID] [--team-name 名前] [--owner-user-id ID] [--region R]`)
    log(`合言葉は引数ではなく環境変数 ${PASSPHRASE_ENV} で指定してください`)
    return 1
  }
  const { opts } = parsed
  const optsError = validateOpts(opts)
  if (optsError) {
    log(`エラー: ${optsError}`)
    return 1
  }

  // ---- 起動時の表示（dry-run / apply 共通）----
  log('=== 既定チームへの移行 ===')
  log(`モード: ${opts.apply ? 'APPLY（書き込みを行います）' : 'DRY-RUN（書き込みなし）'}`)
  log(`リージョン: ${opts.region}`)
  log(`AWS_PROFILE: ${env.AWS_PROFILE ? env.AWS_PROFILE : '未設定'}`)
  log(`対象テーブル: ${Object.values(TABLE).join(', ')}`)
  log(`既定チーム: ${opts.teamId}（${opts.teamName}）`)

  // 合言葉は値・長さ・ハッシュを一切表示しない。形式の OK / NG（理由コード）だけを出す
  const rawPass = typeof env[PASSPHRASE_ENV] === 'string' && env[PASSPHRASE_ENV] !== '' ? env[PASSPHRASE_ENV] : null
  let pass = null
  let passNg = null
  if (rawPass === null) {
    log(`${PASSPHRASE_ENV}: 未設定${opts.apply ? '' : '（--apply には必要）'}`)
  } else {
    try {
      pass = normalizePassphrase(rawPass)
      log(`${PASSPHRASE_ENV}: OK`)
    } catch (err) {
      passNg = err instanceof PassphraseError ? err.reason : 'invalid'
      log(`${PASSPHRASE_ENV}: NG（${passNg}）`)
    }
  }

  const sdkRequire = createRequire(path.join(__dirname, '..', 'src', 'index.js'))
  const { DynamoDBClient } = sdkRequire('@aws-sdk/client-dynamodb')
  const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand } = sdkRequire('@aws-sdk/lib-dynamodb')
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: opts.region }))

  // 書き込みフェーズでの進捗（中断時に表示する）
  const stats = {
    team: { done: 0, skipped: 0 },
    members: { done: 0, skipped: 0 },
    users: { done: 0, skipped: 0 },
    posts: { done: 0, skipped: 0 },
    events: { done: 0, skipped: 0 },
  }
  let phase = '読み取り'

  try {
    // ---- 読み取り（計画の作成）----
    const { Item: existingTeam } = await ddb.send(new GetCommand({
      TableName: TABLE.teams, Key: { teamId: opts.teamId }, ProjectionExpression: 'teamId', ConsistentRead: true,
    }))
    const teamExists = !!existingTeam

    const users = await scanAll(ddb, ScanCommand, {
      TableName: TABLE.users,
      ProjectionExpression: 'userId, #n, createdAt, lastTeamId',
      ExpressionAttributeNames: { '#n': 'name' },
      ConsistentRead: true,
    })
    const eligible = users.filter(u => typeof u.userId === 'string' && u.userId !== '' && typeof u.name === 'string' && typeof u.createdAt === 'string')
    const excluded = users.length - eligible.length
    eligible.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.userId < b.userId ? -1 : 1))

    const existingMembers = teamExists ? await queryMembers(ddb, QueryCommand, opts.teamId, { expr: 'userId, #r', names: { '#r': 'role' } }) : []
    const memberIds = new Set(existingMembers.map(m => m.userId))
    const hasOwner = existingMembers.some(m => m.role === 'owner')

    let owner = null
    if (opts.ownerUserId !== null) {
      owner = eligible.find(u => u.userId === opts.ownerUserId) ?? null
      if (!owner) {
        log('エラー: --owner-user-id が移行対象の users に含まれていません')
        return 1
      }
    } else if (eligible.length > 0) {
      owner = eligible[0]
    }

    const posts = await scanAll(ddb, ScanCommand, { TableName: TABLE.posts, ProjectionExpression: 'postId, teamId', ConsistentRead: true })
    const events = await scanAll(ddb, ScanCommand, { TableName: TABLE.events, ProjectionExpression: 'eventId, teamId', ConsistentRead: true })
    const postsTodo = posts.filter(p => typeof p.postId === 'string' && p.teamId === undefined)
    const eventsTodo = events.filter(e => typeof e.eventId === 'string' && e.teamId === undefined)
    const membersTodo = eligible.filter(u => !memberIds.has(u.userId))
    const usersTodo = eligible.filter(u => u.lastTeamId === undefined)
    // 既にオーナーがいるチームには新たにオーナーを作らない（再実行で複数オーナーにしない）
    const ownerToCreate = !hasOwner && owner && !memberIds.has(owner.userId) ? owner.userId : null

    // ---- 計画の表示 ----
    log('')
    log(`既定チーム: ${teamExists ? '作成済み（変更しません）' : '未作成 → 作成予定'}`)
    log(`${TABLE.users}: 全${users.length}件、移行対象 ${eligible.length}件`)
    if (excluded > 0) log(`警告: userId / name / createdAt が揃っていない users を ${excluded}件 除外しました`)
    if (owner) log(`オーナー: ${owner.userId.slice(0, 8)}…${hasOwner ? '（既にオーナーがいるため新規作成なし）' : ''}`)
    if (!hasOwner && owner && memberIds.has(owner.userId)) log('警告: オーナー不在のチームです。このスクリプトは既存メンバーの役割を変更しません')
    log(`${TABLE.teamMembers}: 作成予定 ${membersTodo.length}件（オーナー ${ownerToCreate ? 1 : 0}件、メンバー ${membersTodo.length - (ownerToCreate ? 1 : 0)}件）`)
    log(`${TABLE.users}: lastTeamId なし ${usersTodo.length}件 → 更新予定 ${usersTodo.length}件`)
    log(`${TABLE.posts}: teamId なし ${postsTodo.length}件 → 更新予定 ${postsTodo.length}件`)
    log(`${TABLE.events}: teamId なし ${eventsTodo.length}件 → 更新予定 ${eventsTodo.length}件`)

    if (eligible.length === 0) {
      log('対象 users 0件')
      if (opts.apply) {
        log('エラー: 対象 users が0件のためオーナーを決められません。何も書き込みません')
        return 1
      }
    }

    if (!opts.apply) {
      log('')
      log('DRY-RUN のため何も書き込んでいません。実行するには --apply を付けてください')
      return 0
    }

    // ---- apply の事前検証（何も書く前に失敗させる）----
    let hashed = null
    if (!teamExists) {
      if (rawPass === null) {
        log(`エラー: 既定チームが未作成のため環境変数 ${PASSPHRASE_ENV} が必要です。何も書き込みません`)
        return 1
      }
      if (passNg !== null) {
        log(`エラー: ${PASSPHRASE_ENV} の形式が不正です（${passNg}）。何も書き込みません`)
        return 1
      }
    }

    // ---- 確認 ----
    if (!opts.yes) {
      log('')
      const answer = await askLine(stdin, log, '上記の内容で書き込みます。続行するには y を入力してください（それ以外は中止）:')
      if (answer !== 'y') {
        log('中止しました。何も書き込んでいません')
        return 0
      }
    }

    // ---- 書き込み ----
    const now = new Date().toISOString()
    if (!teamExists) {
      phase = 'チーム作成'
      hashed = await hashPassphrase(pass)
      await conditional(stats.team, () => ddb.send(new PutCommand({
        TableName: TABLE.teams,
        Item: {
          teamId: opts.teamId, name: opts.teamName,
          passphraseHash: hashed.hash, passphraseSalt: hashed.salt, passphraseKdf: hashed.kdf,
          createdBy: owner.userId, createdByName: owner.name, createdAt: now, memberCount: 0,
        },
        ConditionExpression: 'attribute_not_exists(teamId)',
      })))
    }

    phase = 'メンバー登録'
    for (const u of eligible) {
      if (memberIds.has(u.userId)) continue
      await conditional(stats.members, () => ddb.send(new PutCommand({
        TableName: TABLE.teamMembers,
        Item: {
          teamId: opts.teamId, userId: u.userId, role: u.userId === ownerToCreate ? 'owner' : 'member',
          joinedAt: u.createdAt, userName: u.name,
        },
        ConditionExpression: 'attribute_not_exists(teamId)',
      })))
    }

    phase = 'users の lastTeamId 設定'
    for (const u of eligible) {
      if (u.lastTeamId !== undefined) continue
      await conditional(stats.users, () => ddb.send(new UpdateCommand({
        TableName: TABLE.users, Key: { userId: u.userId },
        UpdateExpression: 'SET lastTeamId = :t',
        ConditionExpression: 'attribute_exists(userId) AND attribute_not_exists(lastTeamId)',
        ExpressionAttributeValues: { ':t': opts.teamId },
      })))
    }

    phase = 'posts の teamId 設定'
    for (const p of postsTodo) {
      await conditional(stats.posts, () => ddb.send(new UpdateCommand({
        TableName: TABLE.posts, Key: { postId: p.postId },
        UpdateExpression: 'SET teamId = :t',
        ConditionExpression: 'attribute_exists(postId) AND attribute_not_exists(teamId)',
        ExpressionAttributeValues: { ':t': opts.teamId },
      })))
    }

    phase = 'events の teamId 設定'
    for (const e of eventsTodo) {
      await conditional(stats.events, () => ddb.send(new UpdateCommand({
        TableName: TABLE.events, Key: { eventId: e.eventId },
        UpdateExpression: 'SET teamId = :t',
        ConditionExpression: 'attribute_exists(eventId) AND attribute_not_exists(teamId)',
        ExpressionAttributeValues: { ':t': opts.teamId },
      })))
    }

    phase = 'memberCount の再計算'
    const counted = (await queryMembers(ddb, QueryCommand, opts.teamId, { expr: 'userId' })).length
    const countStat = { done: 0, skipped: 0 }
    await conditional(countStat, () => ddb.send(new UpdateCommand({
      TableName: TABLE.teams, Key: { teamId: opts.teamId },
      UpdateExpression: 'SET memberCount = :n',
      ConditionExpression: 'attribute_exists(teamId)',
      ExpressionAttributeValues: { ':n': counted },
    })))

    log('')
    log('=== 結果 ===')
    log(`${TABLE.teams}: ${teamExists ? '作成済みのため変更なし' : `作成 ${stats.team.done}件、条件不成立 ${stats.team.skipped}件`}、memberCount = ${counted}${countStat.skipped ? '（条件不成立）' : ''}`)
    log(`${TABLE.teamMembers}: 作成 ${stats.members.done}件、条件不成立 ${stats.members.skipped}件`)
    log(`${TABLE.users}: lastTeamId 更新済み ${stats.users.done}件、条件不成立 ${stats.users.skipped}件`)
    log(`${TABLE.posts}: 更新済み ${stats.posts.done}件、条件不成立 ${stats.posts.skipped}件`)
    log(`${TABLE.events}: 更新済み ${stats.events.done}件、条件不成立 ${stats.events.skipped}件`)
    return 0
  } catch (err) {
    // 理由コードと件数だけを出す（メッセージ本文や項目の内容は出さない）
    log('')
    log(`エラー: ${phase}で中断しました（理由コード: ${err && err.name ? err.name : 'UnknownError'}）`)
    log(`処理済み: チーム ${stats.team.done}件、メンバー ${stats.members.done}件、users ${stats.users.done}件、posts ${stats.posts.done}件、events ${stats.events.done}件`)
    log('再実行すると続きから進められます')
    return 1
  }
}

module.exports = { main }

if (require.main === module) {
  main(process.argv.slice(2)).then(code => {
    process.exitCode = code
  })
}
