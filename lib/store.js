import { get, put } from '@vercel/blob'

const PATH = 'ledger.json'

function empty() {
  return { coins: [], platformId: '', creatorPot: 0 }
}

export async function readLedger() {
  try {
    const result = await get(PATH, { access: 'private', useCache: false })
    if (!result?.stream) return empty()
    const text = await new Response(result.stream).text()
    const data = JSON.parse(text)
    return {
      coins: Array.isArray(data.coins) ? data.coins : [],
      platformId: typeof data.platformId === 'string' ? data.platformId : '',
      creatorPot: Number.isFinite(Number(data.creatorPot)) ? Number(data.creatorPot) : 0,
    }
  } catch (error) {
    const message = `${error?.name || ''} ${error?.message || ''}`
    if (message.includes('NotFound') || message.includes('404') || message.includes('not found')) return empty()
    throw error
  }
}

export async function writeLedger(ledger) {
  await put(PATH, JSON.stringify(ledger), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
  return ledger
}
