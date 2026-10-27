const REDIRECT = 'https://usegitlaunch.fun/api/x/callback'

export function xConfigured() {
  return Boolean((process.env.X_CLIENT_ID || '').trim() && (process.env.X_CLIENT_SECRET || '').trim())
}

export function xRedirect() {
  return REDIRECT
}

export function xAuthorizeUrl({ challenge, state }) {
  const id = (process.env.X_CLIENT_ID || '').trim()
  if (!id) throw new Error('X sign-in is not configured.')
  const url = new URL('https://x.com/i/oauth2/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', id)
  url.searchParams.set('redirect_uri', REDIRECT)
  url.searchParams.set('scope', 'users.read tweet.read')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

async function postToken(url, code, verifier) {
  const id = (process.env.X_CLIENT_ID || '').trim()
  const secret = (process.env.X_CLIENT_SECRET || '').trim()
  if (!id || !secret) throw new Error('X sign-in is not configured.')
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
    client_id: id,
  })
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body,
  })
  const token = await response.json().catch(() => ({}))
  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || 'X did not authorize')
  }
  return token.access_token
}

async function fetchMe(url, access) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' },
  })
  const body = await response.json().catch(() => ({}))
  const user = body.data
  if (!user?.id || !user.username) throw new Error(body.detail || 'X did not return the account')
  return { id: String(user.id), login: String(user.username) }
}

export async function exchangeXCode(code, verifier) {
  let last = 'X did not authorize'
  for (const url of ['https://api.x.com/2/oauth2/token', 'https://api.twitter.com/2/oauth2/token']) {
    try {
      const access = await postToken(url, code, verifier)
      for (const me of ['https://api.x.com/2/users/me', 'https://api.twitter.com/2/users/me']) {
        try {
          return await fetchMe(me, access)
        } catch (error) {
          last = error.message
        }
      }
    } catch (error) {
      last = error.message
    }
  }
  throw new Error(last)
}
