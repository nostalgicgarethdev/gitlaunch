import { Keypair } from '@solana/web3.js'
import { githubUser } from '../lib/github.js'
import { cleanError, json, readJson, xFrom } from '../lib/http.js'
import { nextLaunchAt } from '../lib/fees.js'
import { CREATOR_FEE, PLATFORM_FEE, createCoin, devBalance, ensurePlatform } from '../lib/launchpad.js'
import { readLedger, writeLedger } from '../lib/store.js'

function website(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const url = new URL(href)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Website has to be a link.')
  return url.href
}

function twitter(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return website(raw)
  const handle = raw.replace(/^@/, '')
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) throw new Error('Twitter should be a handle.')
  return `@${handle}`
}

function tweetLink(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const href = website(raw)
  const url = new URL(href)
  const host = url.hostname.replace(/^www\./, '')
  if ((host !== 'x.com' && host !== 'twitter.com') || !/^\/[^/]+\/status\/\d+/.test(url.pathname)) {
    throw new Error('Tweet link has to be an X post.')
  }
  return `${url.origin}${url.pathname}`
}

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use the launch form.' })
  try {
    const body = await readJson(req)
    const name = String(body.name || '').trim()
    const ticker = String(body.ticker || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const logo = typeof body.logo === 'string' && body.logo.startsWith('data:image/') ? body.logo : ''
    if (!name || name.length > 32 || ticker.length < 2 || ticker.length > 10) {
      return json(res, 400, { error: 'Add a name and a ticker.' })
    }
    if (logo.length > 180_000) return json(res, 400, { error: 'That logo is too big.' })
    const launcher = xFrom(req)
    if (!launcher) return json(res, 401, { error: 'Sign in with X to launch.' })
    const user = await githubUser(body.github)
    const social = twitter(body.twitter)
    const site = website(body.website)
    const tweet = tweetLink(body.tweet)
    const ledgerPeek = await readLedger()
    const waitUntil = nextLaunchAt(ledgerPeek.coins, launcher.id)
    if (waitUntil) {
      const mins = Math.max(1, Math.ceil((waitUntil - Date.now()) / 60000))
      return json(res, 429, { error: `This X account can launch again in ${mins} min.` })
    }
    const funds = await devBalance()
    if (funds.lamports < 200_000_000) {
      return json(res, 400, {
        error: `The master wallet ${funds.address} has ${(funds.lamports / 1e9).toFixed(4)} SOL. It needs about 0.2 SOL to create the coin on Launch.`,
      })
    }
    const ledger = ledgerPeek
    if (ledger.coins.some((coin) => coin.ticker === ticker)) {
      return json(res, 400, { error: 'That ticker is already launched.' })
    }
    const platformId = await ensurePlatform(ledger)
    ledger.platformId = platformId
    const pair = Keypair.generate()
    const ca = pair.publicKey.toBase58()
    const coin = {
      ticker,
      name,
      ca,
      github: user.login,
      githubId: user.id,
      xId: launcher.id,
      xLogin: launcher.login,
      twitter: social,
      website: site,
      tweet,
      logo,
      paidLamports: 0,
      claims: [],
      creatorFeeRate: CREATOR_FEE,
      platformFeeRate: PLATFORM_FEE,
    }
    ledger.coins.unshift(coin)
    await writeLedger(ledger)
    try {
      const created = await createCoin({
        name,
        symbol: ticker,
        uri: `https://usegitlaunch.fun/api/meta?mint=${ca}`,
        platformId,
        pair,
      })
      coin.poolId = created.poolId
      coin.signature = created.signature
      coin.launchedAt = Date.now()
      await writeLedger(ledger)
      json(res, 200, {
        ticker,
        ca,
        github: user.login,
        githubId: user.id,
        signature: created.signature,
        dev: funds.address,
      })
    } catch (error) {
      const fresh = await readLedger()
      fresh.coins = fresh.coins.filter((item) => item.ca !== ca)
      fresh.platformId = fresh.platformId || platformId
      await writeLedger(fresh)
      json(res, 400, { error: cleanError(error) })
    }
  } catch (error) {
    json(res, 400, { error: cleanError(error) })
  }
}
