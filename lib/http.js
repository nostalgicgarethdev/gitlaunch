import { readSession, readXSession } from './session.js'

export function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function redirect(res, location, cookies = []) {
  res.statusCode = 302
  res.setHeader('Location', location)
  if (cookies.length) res.setHeader('Set-Cookie', cookies)
  res.end()
}

export function cookie(name, value, maxAge) {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  return parts.join('; ')
}

export function cookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name) continue
    out[name] = rest.join('=')
  }
  return out
}

export function sessionFrom(req) {
  try {
    return readSession(cookies(req).gitlaunch_session)
  } catch {
    return null
  }
}

export function xFrom(req) {
  try {
    return readXSession(cookies(req).gitlaunch_x)
  } catch {
    return null
  }
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw)
}

export function cleanError(error) {
  const logs = error?.logs || error?.transactionLogs
  let text = ''
  if (typeof error?.message === 'string' && error.message && error.message !== '[object Object]') text = error.message
  else if (Array.isArray(logs)) {
    text = [...logs].reverse().find((line) => /Error Message:|AnchorError|failed:/.test(line)) || ''
  }
  if (!text) text = 'Something failed'
  text = String(text)
  if (text.length > 280) return 'The chain rejected the transaction.'
  return text.replace(/\[(\d+,){8,}\d+\]/g, '[key]')
}
