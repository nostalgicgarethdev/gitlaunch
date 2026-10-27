import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

const DAY = 24 * 60 * 60 * 1000

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('Sign-in is not configured.')
  return value
}

function sign(body) {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

function pack(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

function open(token) {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export function createOAuthState() {
  return pack({ n: randomBytes(16).toString('hex'), exp: Date.now() + 10 * 60 * 1000 })
}

export function verifyOAuthState(state) {
  const payload = open(state)
  return Boolean(payload?.exp && payload.exp > Date.now())
}

export function createSession(user) {
  return pack({
    id: user.id,
    login: user.login,
    exp: Date.now() + 14 * DAY,
  })
}

export function readSession(token) {
  const payload = open(token)
  if (payload?.kind === 'x') return null
  if (!payload?.login || !payload.id || !payload.exp || payload.exp < Date.now()) return null
  return { id: Number(payload.id), login: payload.login }
}

export function xPkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const state = randomBytes(16).toString('hex')
  return {
    state,
    verifier,
    challenge,
    token: pack({ state, verifier, exp: Date.now() + 10 * 60 * 1000 }),
  }
}

export function readXOauth(token) {
  const payload = open(token)
  if (!payload?.state || !payload.verifier || !payload.exp || payload.exp < Date.now()) return null
  return { state: payload.state, verifier: payload.verifier }
}

export function createXSession(user) {
  return pack({
    id: String(user.id),
    login: user.login,
    kind: 'x',
    exp: Date.now() + 14 * DAY,
  })
}

export function readXSession(token) {
  const payload = open(token)
  if (payload?.kind !== 'x' || !payload.login || !payload.id || !payload.exp || payload.exp < Date.now()) return null
  return { id: String(payload.id), login: payload.login }
}
