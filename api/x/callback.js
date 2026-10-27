import { exchangeXCode } from '../../lib/x.js'
import { createXSession, readXOauth } from '../../lib/session.js'
import { cookie, cookies, redirect } from '../../lib/http.js'

export default async function handler(req, res) {
  const url = new URL(req.url, 'https://usegitlaunch.fun')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const pending = readXOauth(cookies(req).gitlaunch_x_oauth)
  const clear = cookie('gitlaunch_x_oauth', '', 0)
  if (!code || !pending || pending.state !== state) {
    return redirect(res, '/launch.html?error=state', [clear])
  }
  try {
    const user = await exchangeXCode(code, pending.verifier)
    const session = createXSession(user)
    redirect(res, '/launch.html', [cookie('gitlaunch_x', session, 60 * 60 * 24 * 14), clear])
  } catch {
    redirect(res, '/launch.html?error=token', [clear])
  }
}
