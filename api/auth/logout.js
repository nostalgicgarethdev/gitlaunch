import { cookie, redirect } from '../../lib/http.js'

export default function handler(req, res) {
  redirect(res, '/claim.html', [cookie('gitlaunch_session', '', 0)])
}
