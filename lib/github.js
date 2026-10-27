const CLIENT_ID = 'Ov23liECHo01us2fQ1Hy'
const REDIRECT = 'https://usegitlaunch.fun/api/auth/callback'

export function clientId() {
  return process.env.GITHUB_CLIENT_ID || CLIENT_ID
}

export function redirectUri() {
  return REDIRECT
}

export async function githubUser(login) {
  const name = String(login || '').trim().replace(/^@/, '')
  if (!/^[A-Za-z0-9-]+$/.test(name)) throw new Error('Enter a GitHub username')
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(name)}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gitlaunch',
    },
  })
  if (response.status === 404) throw new Error('No GitHub account with that name')
  if (!response.ok) throw new Error('GitHub did not answer')
  const user = await response.json()
  if (!user?.id || !user.login) throw new Error('GitHub did not answer')
  return { login: user.login, id: Number(user.id) }
}

export async function exchangeCode(code) {
  const secret = process.env.GITHUB_CLIENT_SECRET
  if (!secret) throw new Error('GitHub sign-in is not configured.')
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'gitlaunch',
    },
    body: JSON.stringify({
      client_id: clientId(),
      client_secret: secret.trim(),
      code,
      redirect_uri: REDIRECT,
    }),
  })
  const token = await response.json()
  if (!token.access_token) throw new Error(token.error_description || 'GitHub did not authorize')
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.access_token}`,
      'User-Agent': 'gitlaunch',
    },
  })
  const user = await userResponse.json()
  if (!user?.id || !user.login) throw new Error('GitHub did not return the account')
  return { login: user.login, id: Number(user.id) }
}
