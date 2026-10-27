import { json, sessionFrom } from '../../lib/http.js'

export default function handler(req, res) {
  json(res, 200, { user: sessionFrom(req) })
}
