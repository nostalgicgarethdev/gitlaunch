import { exchangeCode } from '../../lib/github.js'
import { createSession, verifyOAuthState } from '../../lib/session.js'
import { cookie, redirect } from '../../lib/http.js'

export default async function handler(req, res) {
  const url = new URL(req.url, 'https://usegitlaunch.fun')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !verifyOAuthState(state)) return redirect(res, '/claim.html?error=state')
  try {
    const user = await exchangeCode(code)
    const session = createSession(user)
    redirect(res, '/claim.html', [cookie('gitlaunch_session', session, 60 * 60 * 24 * 14)])
  } catch {
    redirect(res, '/claim.html?error=token')
  }
}
