import { json, xFrom } from '../../lib/http.js'
import { xConfigured } from '../../lib/x.js'

export default function handler(req, res) {
  json(res, 200, { user: xFrom(req), configured: xConfigured() })
}
