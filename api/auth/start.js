import { clientId, redirectUri } from '../../lib/github.js'
import { createOAuthState } from '../../lib/session.js'
import { redirect } from '../../lib/http.js'

export default function handler(req, res) {
  try {
    const state = createOAuthState()
    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', clientId())
    url.searchParams.set('redirect_uri', redirectUri())
    url.searchParams.set('scope', 'read:user')
    url.searchParams.set('state', state)
    redirect(res, url.toString())
  } catch {
    redirect(res, '/claim.html?error=config')
  }
}
