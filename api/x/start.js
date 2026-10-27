import { xAuthorizeUrl, xConfigured } from '../../lib/x.js'
import { xPkce } from '../../lib/session.js'
import { cookie, redirect } from '../../lib/http.js'

export default function handler(req, res) {
  try {
    if (!xConfigured()) return redirect(res, '/launch.html?error=config')
    const oauth = xPkce()
    redirect(res, xAuthorizeUrl(oauth), [cookie('gitlaunch_x_oauth', oauth.token, 600)])
  } catch {
    redirect(res, '/launch.html?error=config')
  }
}
