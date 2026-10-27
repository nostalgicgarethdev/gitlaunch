import { attributeCreatorFees } from '../lib/fees.js'
import { json } from '../lib/http.js'
import { CREATOR_FEE, creatorVaultAmount, devBalance, poolFees } from '../lib/launchpad.js'
import { readLedger, writeLedger } from '../lib/store.js'

const PROTOCOL_RATE = 2_500

function sol(lamports) {
  const value = Number(lamports) / 1e9
  if (!Number.isFinite(value) || value <= 0) return '0.0000'
  if (value < 0.0001) return value.toFixed(6)
  return value.toFixed(4)
}

export function publicCoin(coin, owed) {
  return {
    ticker: coin.ticker,
    name: 'test',
    ca: coin.ca,
    poolId: coin.poolId || '',
    github: coin.github,
    githubId: coin.githubId,
    twitter: coin.twitter || '',
    website: coin.website || '',
    tweet: coin.tweet || '',
    logo: coin.logo || '',
    signature: coin.signature || '',
    unclaimed: sol(owed),
    unclaimedLamports: owed,
    claims: (coin.claims || []).slice(0, 8),
  }
}

export default async function handler(req, res) {
  try {
    const ledger = await readLedger()
    const live = ledger.coins.filter((coin) => coin.signature)
    let vault = null
    try {
      vault = await creatorVaultAmount()
    } catch {
      vault = null
    }
    const quoted = []
    let dirty = false
    for (const coin of live) {
      let protocol = 0n
      try {
        const fees = await poolFees(coin.ca)
        protocol = BigInt(fees?.protocolFee || 0)
      } catch {
        protocol = 0n
      }
      if (coin.protocolSeen == null) {
        const paid = BigInt(coin.paidLamports || 0)
        const baseline = paid > 0n ? (paid * BigInt(PROTOCOL_RATE)) / BigInt(CREATOR_FEE) : 0n
        coin.protocolSeen = Number(baseline > protocol ? protocol : baseline)
        dirty = true
      }
      quoted.push({
        ticker: coin.ticker,
        protocolFee: protocol.toString(),
        protocolSeen: coin.protocolSeen || 0,
      })
    }
    const shares = attributeCreatorFees({
      coins: quoted,
      vault,
      pot: ledger.creatorPot || 0,
    })
    const coins = live.map((coin) => {
      const owed = Number(shares[coin.ticker] || 0n)
      const seen = Number(BigInt(coin.paidLamports || 0) + BigInt(owed))
      if (seen > Number(coin.feeSeen || 0)) {
        coin.feeSeen = seen
        dirty = true
      }
      return publicCoin(coin, owed)
    })
    if (dirty) await writeLedger(ledger)
    const dev = await devBalance()
    const cash = (vault == null ? 0n : vault) + BigInt(ledger.creatorPot || 0)
    json(res, 200, {
      dev: dev.address,
      devSol: sol(dev.lamports),
      unclaimedSol: sol(cash),
      unclaimedLamports: Number(cash),
      coins,
    })
  } catch (error) {
    json(res, 500, { error: 'The coin list did not load.' })
  }
}
