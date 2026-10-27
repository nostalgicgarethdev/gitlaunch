import { cleanError, json, readJson, sessionFrom } from '../lib/http.js'
import { payClaim } from '../lib/launchpad.js'
import { readLedger, writeLedger } from '../lib/store.js'

function walletOk(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(value || '').trim())
}

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use the claim form.' })
  const session = sessionFrom(req)
  if (!session) return json(res, 401, { error: 'Sign in with GitHub first.' })
  try {
    const body = await readJson(req)
    const wallet = String(body.wallet || '').trim()
    if (!walletOk(wallet)) return json(res, 400, { error: 'Enter the Solana wallet that should receive the claim.' })
    const ledger = await readLedger()
    const coin = ledger.coins.find((item) => item.ticker === String(body.ticker || ''))
    if (!coin || Number(coin.githubId) !== session.id) {
      return json(res, 403, { error: 'This GitHub account does not claim that coin.' })
    }
    const live = ledger.coins.filter((item) => item.signature)
    const paid = await payClaim({
      coin,
      coins: live,
      destination: wallet,
      pot: ledger.creatorPot || 0,
    })
    coin.paidLamports = (coin.paidLamports || 0) + paid.lamports
    coin.feeSeen = paid.feeSeen
    coin.protocolSeen = Number(paid.protocolFee || coin.protocolSeen || 0)
    ledger.creatorPot = paid.pot
    coin.claims = [{
      amount: (paid.lamports / 1e9).toFixed(4),
      wallet,
      signature: paid.signature,
      at: Date.now(),
    }, ...(coin.claims || [])]
    await writeLedger(ledger)
    json(res, 200, {
      signature: paid.signature,
      amount: (paid.lamports / 1e9).toFixed(4),
      wallet,
    })
  } catch (error) {
    json(res, 400, { error: cleanError(error) })
  }
}
