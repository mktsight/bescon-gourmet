'use strict'
// チームの合言葉: 正規化・ハッシュ化・検証（純粋関数。平文・ハッシュ・saltは例外メッセージにも含めない）
const crypto = require('crypto')
const { promisify } = require('util')

const scrypt = promisify(crypto.scrypt)

const KDF = 'scrypt:N=16384,r=8,p=1,len=32'
const SALT_BYTES = 16
const MIN_LEN = 6
const MAX_LEN = 64
const MAX_RAW_LEN = 256

class PassphraseError extends Error {
  constructor(reason, message) {
    super(message)
    this.name = 'PassphraseError'
    this.reason = reason
    this.field = 'passphrase'
  }
}

// 全角英数字を半角に揃える(NFKC)→前後の空白を除去→6〜64コードポイント・制御文字なし。
// 大文字小文字は区別する。
function normalizePassphrase(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_RAW_LEN) {
    throw new PassphraseError('chars', '合言葉に使えない文字が含まれています')
  }
  const pass = raw.normalize('NFKC').trim()
  if (/[\u0000-\u001f\u007f]/.test(pass)) {
    throw new PassphraseError('chars', '合言葉に使えない文字が含まれています')
  }
  const len = [...pass].length
  if (len < MIN_LEN) throw new PassphraseError('short', `合言葉は${MIN_LEN}文字以上で入力してください`)
  if (len > MAX_LEN) throw new PassphraseError('long', `合言葉は${MAX_LEN}文字以内で入力してください`)
  return pass
}

function parseKdf(kdf) {
  const m = /^scrypt:N=(\d+),r=(\d+),p=(\d+),len=(\d+)$/.exec(typeof kdf === 'string' ? kdf : '')
  if (!m) return null
  const [N, r, p, len] = m.slice(1).map(Number)
  if (!(N >= 2 && (N & (N - 1)) === 0 && N <= 1 << 20) || !(r >= 1 && r <= 32) || !(p >= 1 && p <= 16) || !(len >= 16 && len <= 128)) return null
  return { N, r, p, len }
}

function scryptOptions({ N, r, p }) {
  return { N, r, p, maxmem: 256 * N * r + 1024 * 1024 }
}

// pass は normalizePassphrase 済みの文字列
async function hashPassphrase(pass) {
  const salt = crypto.randomBytes(SALT_BYTES)
  const params = parseKdf(KDF)
  const hash = await scrypt(pass, salt, params.len, scryptOptions(params))
  return { hash: hash.toString('base64'), salt: salt.toString('base64'), kdf: KDF }
}

async function verifyPassphrase(pass, { hash, salt, kdf } = {}) {
  const params = parseKdf(kdf)
  if (!params || typeof hash !== 'string' || typeof salt !== 'string') return false
  const expected = Buffer.from(hash, 'base64')
  const saltBuf = Buffer.from(salt, 'base64')
  if (expected.length !== params.len || saltBuf.length === 0) return false
  const actual = await scrypt(pass, saltBuf, params.len, scryptOptions(params))
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

module.exports = { normalizePassphrase, hashPassphrase, verifyPassphrase, PassphraseError, KDF }
