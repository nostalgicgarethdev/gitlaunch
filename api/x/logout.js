import { cookie, redirect } from '../../lib/http.js'

export default function handler(req, res) {
  redirect(res, '/launch.html', [cookie('gitlaunch_x', '', 0)])
}
