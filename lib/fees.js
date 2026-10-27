export const LAUNCH_GAP_MS = 10 * 60 * 1000

export function creatorShare(platformFee, creatorRate = 10000, platformRate = 10000) {
  const fee = BigInt(platformFee || 0)
  const creator = BigInt(creatorRate || 0)
  const platform = BigInt(platformRate || 0)
  if (fee <= 0n || creator <= 0n || platform <= 0n) return 0n
  return (fee * creator) / platform
}

export function coinOwed({ platformFee, creatorRate, platformRate, feeSeen, paidLamports }) {
  const now = creatorShare(platformFee, creatorRate, platformRate)
  const seen = BigInt(feeSeen || 0)
  const high = now > seen ? now : seen
  const paid = BigInt(paidLamports || 0)
  const owed = high > paid ? high - paid : 0n
  return { feeSeen: high, owed }
}

export function claimPayout({ owed, pot, swept, balance, reserve }) {
  const gained = BigInt(swept || 0)
  const nextPot = BigInt(pot || 0) + (gained > 0n ? gained : 0n)
  let pay = BigInt(owed || 0)
  if (pay > nextPot) pay = nextPot
  const spendable = BigInt(balance || 0) - BigInt(reserve || 0)
  if (pay > spendable) pay = spendable > 0n ? spendable : 0n
  if (pay < 0n) pay = 0n
  return { pay, pot: nextPot - pay }
}

// Creator fee is 0.5%. Raydium protocol fee is 0.25%. A protocol-fee increase
// of D lamports means about 2D of creator fee on the same trades.
const PROTOCOL_RATE = 2_500
const CREATOR_RATE = 5_000

export function attributeCreatorFees({ coins, vault, pot = 0 }) {
  const rows = (coins || []).map((coin) => {
    const protocol = BigInt(coin.protocolFee || 0)
    const seen = BigInt(coin.protocolSeen || 0)
    const delta = protocol > seen ? protocol - seen : 0n
    return { ticker: coin.ticker, raw: (delta * BigInt(CREATOR_RATE)) / BigInt(PROTOCOL_RATE) }
  })
  const sum = rows.reduce((total, row) => total + row.raw, 0n)
  const cash = vault == null ? null : BigInt(vault) + BigInt(pot || 0)
  const shares = {}
  let left = cash == null ? 0n : cash
  rows.forEach((row, index) => {
    let part = row.raw
    if (cash != null) {
      if (sum === 0n || cash <= 0n) part = 0n
      else if (index === rows.length - 1) part = left > 0n ? left : 0n
      else part = (cash * row.raw) / sum
      if (part > left) part = left
      left -= part
    }
    shares[row.ticker] = part < 0n ? 0n : part
  })
  return shares
}

export function nextLaunchAt(coins, xId, now = Date.now()) {
  const last = (coins || [])
    .filter((coin) => coin.signature && String(coin.xId) === String(xId) && coin.launchedAt)
    .reduce((max, coin) => Math.max(max, Number(coin.launchedAt) || 0), 0)
  if (!last || now - last >= LAUNCH_GAP_MS) return 0
  return last + LAUNCH_GAP_MS
}
