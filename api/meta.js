import { readLedger } from '../lib/store.js'

function coinFrom(req) {
  const url = new URL(req.url, 'https://usegitlaunch.fun')
  return url.searchParams.get('mint') || ''
}

export default async function handler(req, res) {
  const mint = coinFrom(req)
  const url = new URL(req.url, 'https://usegitlaunch.fun')
  const ledger = await readLedger()
  const coin = ledger.coins.find((item) => item.ca === mint)
  if (!coin) {
    res.statusCode = 404
    res.end('Not found')
    return
  }
  if (url.searchParams.get('img') === '1') {
    const logo = coin.logo || ''
    const match = logo.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
    if (!match) {
      res.statusCode = 302
      res.setHeader('Location', 'https://usegitlaunch.fun/logo.png')
      res.end()
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', match[1])
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.end(Buffer.from(match[2], 'base64'))
    return
  }
  const image = coin.logo
    ? `https://usegitlaunch.fun/api/meta?mint=${encodeURIComponent(coin.ca)}&img=1`
    : 'https://usegitlaunch.fun/logo.png'
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=60')
  res.end(JSON.stringify({
    name: coin.name,
    symbol: coin.ticker,
    description: `Launched on GitLaunch for @${coin.github}.`,
    image,
    external_url: coin.website || 'https://usegitlaunch.fun',
    extensions: {
      twitter: coin.twitter || '',
      website: coin.website || '',
    },
  }))
}
