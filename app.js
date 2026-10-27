const $ = (id) => document.getElementById(id)

let coins = []
let session = null
let selected = ''
let logoData = ''

function solText(value) {
  return value || '0.0000'
}

function walletOk(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim())
}

function shortCa(ca) {
  if (!ca) return ''
  return `${ca.slice(0, 4)}…${ca.slice(-4)}`
}

function say(text) {
  const note = $('note')
  if (note) note.textContent = text
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]))
}

function safeLogo(value) {
  return typeof value === 'string' && value.startsWith('data:image/') ? value : ''
}

function safeUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href
  } catch {
    // Leave a bad address as plain text.
  }
  return ''
}

function twitterLink(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) {
    const href = safeUrl(raw)
    return href ? { href, label: href.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, '@').replace(/\/$/, '') } : null
  }
  const handle = raw.replace(/^@/, '')
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return { href: '', label: raw }
  return { href: `https://x.com/${handle}`, label: `@${handle}` }
}

function postLink(value) {
  const href = safeUrl(String(value || '').trim())
  if (!href) return null
  return { href, label: 'tweet' }
}

function webLink(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const href = safeUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  if (!href) return { href: '', label: raw }
  return { href, label: href.replace(/^https?:\/\//, '').replace(/\/$/, '') }
}

function linkHtml(link) {
  if (!link) return ''
  if (!link.href) return `<span>${escapeHtml(link.label)}</span>`
  return `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`
}

function owned() {
  if (!session) return []
  return coins.filter((coin) => coin.githubId === session.id)
}

function selectedCoin() {
  return owned().find((coin) => coin.ticker === selected) || owned()[0] || null
}

function paintClaim() {
  if (!$('session')) return
  $('session').textContent = session ? `@${session.login} · id ${session.id}` : 'Not signed in'
  $('signin').hidden = !!session
  $('signed').hidden = !session
  const mine = owned()
  const select = $('coins')
  select.innerHTML = mine.map((coin) => {
    const mark = coin.ticker === selected ? ' selected' : ''
    return `<option value="${coin.ticker}"${mark}>${coin.name} · ${coin.ticker} · ${shortCa(coin.ca)} · @${coin.github}</option>`
  }).join('')
  const coin = selectedCoin()
  if (!coin) {
    $('calink').textContent = ''
    $('unclaimed').textContent = '0.0000'
    $('accrual').textContent = mine.length ? '' : 'No coin is linked to this GitHub account yet.'
    $('history').innerHTML = ''
    $('claim-go').disabled = true
    return
  }
  selected = coin.ticker
  $('calink').innerHTML = `<a href="https://solscan.io/token/${coin.ca}" target="_blank" rel="noopener">${coin.ca}</a>`
  $('unclaimed').textContent = solText(coin.unclaimed)
  $('accrual').textContent = 'Creator fee on this coin. Claim sends it to the wallet below. Later trades add more.'
  $('claim-go').disabled = Number(coin.unclaimedLamports) <= 0
  $('history').innerHTML = (coin.claims || []).map((claim) => claimItem({
    ...claim,
    ticker: coin.ticker,
    name: coin.name,
    github: coin.github,
  })).join('')
}

function when(at) {
  const time = Number(at)
  if (!time) return ''
  return new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function recentClaims() {
  return coins.flatMap((coin) => (coin.claims || []).map((claim) => ({
    ticker: coin.ticker,
    name: coin.name,
    github: coin.github,
    amount: claim.amount,
    wallet: claim.wallet,
    signature: claim.signature,
    at: claim.at,
  }))).sort((a, b) => Number(b.at || 0) - Number(a.at || 0)).slice(0, 8)
}

function claimItem(claim) {
  const wallet = claim.wallet ? shortCa(claim.wallet) : ''
  const sig = String(claim.signature || '')
  const tx = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(sig)
    ? `<a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">View tx</a>`
    : ''
  const github = claim.github ? `@${claim.github}` : ''
  const title = claim.name || claim.ticker || ''
  const detail = [claim.name ? claim.ticker : '', github].filter(Boolean).join(' · ')
  return `<li>
    <span class="claim-amt">${escapeHtml(claim.amount || '0')} <small>SOL</small></span>
    <span class="claim-who"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></span>
    <span class="claim-to">${wallet ? `to ${escapeHtml(wallet)}` : ''}</span>
    <span class="claim-meta">${escapeHtml(when(claim.at))} ${tx}</span>
  </li>`
}

function paintClaims() {
  const list = $('claims-list')
  if (!list) return
  const rows = recentClaims()
  list.innerHTML = rows.map(claimItem).join('')
  const empty = $('claims-empty')
  if (empty) empty.hidden = rows.length > 0
}

function paintCoins() {
  const list = $('coins-list')
  if (!list) return
  $('coin-count').textContent = String(coins.length)
  $('coins-empty').hidden = coins.length > 0
  list.innerHTML = coins.map((coin) => {
    const logo = safeLogo(coin.logo)
    const face = logo
      ? `<img src="${logo}" alt="" />`
      : `<b>${escapeHtml(coin.ticker.slice(0, 1))}</b>`
    const links = [linkHtml(twitterLink(coin.twitter)), linkHtml(postLink(coin.tweet)), linkHtml(webLink(coin.website))].filter(Boolean).join(' · ')
    const ca = `<a href="https://solscan.io/token/${coin.ca}" target="_blank" rel="noopener">${shortCa(coin.ca)}</a>`
    return `<li>
      <span class="face">${face}</span>
      <span>
        <strong>${escapeHtml(coin.name)}</strong>
        <span class="who">${escapeHtml(coin.ticker)} · @${escapeHtml(coin.github)} · id ${coin.githubId}</span>
        <span class="links">${ca}${links ? ` · ${links}` : ''}</span>
      </span>
      <span class="bal"><b data-unclaimed="${escapeHtml(coin.ticker)}">${escapeHtml(coin.unclaimed)}</b> SOL unclaimed</span>
    </li>`
  }).join('')
}

function paintLauncher(xUser) {
  const signin = $('x-signin')
  const form = $('create-form')
  const line = $('x-line')
  if (!signin || !form) return
  if (xUser) {
    signin.hidden = true
    form.hidden = false
    if (line) {
      line.hidden = false
      line.textContent = `@${xUser.login} · one launch every 10 minutes`
    }
  } else {
    signin.hidden = false
    form.hidden = true
    if (line) line.hidden = true
  }
}

async function loadDesk() {
  const jobs = [
    fetch('/api/auth/me').then((res) => res.json()).catch(() => ({ user: null })),
    fetch('/api/coins').then((res) => res.json()).catch(() => ({ coins: [] })),
  ]
  if ($('create-form')) jobs.push(fetch('/api/x/me').then((res) => res.json()).catch(() => ({ user: null })))
  const [me, list, x] = await Promise.all(jobs)
  session = me.user || null
  coins = list.coins || []
  if ($('dev-line') && list.dev) $('dev-line').textContent = `Dev on every coin · ${list.dev} · ${list.devSol || '0.0000'} SOL`
  paintLauncher(x?.user)
  paintClaim()
  paintCoins()
  paintClaims()
  paintLiveNumbers(list.unclaimedSol)
  const error = new URLSearchParams(location.search).get('error')
  if ($('create-form') && error && $('x-line')) {
    const line = $('x-line')
    line.hidden = false
    if (error === 'state') line.textContent = 'X sign-in expired. Try again.'
    if (error === 'token') line.textContent = 'X did not authorize that account.'
    if (error === 'config') line.textContent = 'X sign-in is not configured yet.'
  }
  if (error === 'state') say('GitHub sign-in expired. Try again.')
  if (error === 'token') say('GitHub did not authorize that account.')
  if (error === 'config') say('GitHub sign-in is not configured.')
}

function readLogo(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const scale = Math.max(size / image.width, size / image.height)
      const width = image.width * scale
      const height = image.height * scale
      canvas.getContext('2d').drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That logo did not load.'))
    }
    image.src = url
  })
}

if ($('coins')) {
  $('coins').addEventListener('change', () => {
    selected = $('coins').value
    paintClaim()
  })
}

if ($('claim-form')) {
  $('claim-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const coin = selectedCoin()
    const wallet = $('wallet').value.trim()
    if (!coin) return
    if (!walletOk(wallet)) {
      say('Enter the Solana wallet that should receive the claim.')
      return
    }
    $('claim-go').disabled = true
    say('Sending the claim…')
    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: coin.ticker, wallet }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'The claim did not send.')
      say(`Sent ${body.amount} SOL to ${wallet}.`)
      await loadDesk()
    } catch (error) {
      say(error.message || 'The claim did not send.')
      $('claim-go').disabled = false
    }
  })
}

if ($('logo')) {
  $('logo').addEventListener('change', async () => {
    const file = $('logo').files?.[0]
    if (!file) return
    try {
      logoData = await readLogo(file)
      $('logo-preview').src = logoData
      $('logo-preview').hidden = false
    } catch (error) {
      logoData = ''
      $('logo-preview').hidden = true
      $('launch-note').textContent = error.message || 'That logo did not load.'
    }
  })
}

if ($('create-form')) {
  $('create-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const note = $('launch-note')
    const button = event.target.querySelector('button')
    const name = $('name').value.trim()
    const ticker = $('ticker').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    button.disabled = true
    note.textContent = 'Creating the coin on Launch…'
    try {
      const response = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          ticker,
          github: $('owner').value.trim(),
          twitter: $('twitter').value.trim(),
          website: $('website').value.trim(),
          tweet: $('tweet').value.trim(),
          logo: logoData,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Launch did not go through.')
      note.textContent = `${body.ticker} is on Launch. Mint ${body.ca}. Linked to @${body.github} · id ${body.githubId}.`
      $('name').value = ''
      $('ticker').value = ''
      $('owner').value = ''
      $('twitter').value = ''
      $('website').value = ''
      $('tweet').value = ''
      $('logo').value = ''
      logoData = ''
      $('logo-preview').hidden = true
    } catch (error) {
      note.textContent = error.message || 'Launch did not go through.'
    } finally {
      button.disabled = false
    }
  })
}

document.querySelectorAll('.copy-ca').forEach((button) => {
  button.addEventListener('click', async () => {
    const ca = button.getAttribute('data-ca') || ''
    try {
      await navigator.clipboard.writeText(ca)
      button.textContent = 'Copied'
    } catch {
      button.textContent = 'Copy'
    }
    setTimeout(() => {
      button.textContent = 'Copy'
    }, 1200)
  })
})

function paintLiveNumbers(totalText) {
  const total = $('unclaimed-total')
  if (total && totalText) total.textContent = totalText
  for (const coin of coins) {
    document.querySelectorAll(`[data-unclaimed="${coin.ticker}"]`).forEach((el) => {
      el.textContent = coin.unclaimed
    })
  }
  const current = selectedCoin()
  if ($('unclaimed') && current) {
    $('unclaimed').textContent = solText(current.unclaimed)
    if ($('claim-go')) $('claim-go').disabled = Number(current.unclaimedLamports) <= 0
  }
}

async function refreshUnclaimed() {
  if (document.hidden) return
  const list = await fetch('/api/coins', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)).catch(() => null)
  if (!list?.coins) return
  const keyOf = (rows) => rows.map((coin) => `${coin.ticker}:${(coin.claims || []).length}`).join('|')
  const changed = keyOf(list.coins) !== keyOf(coins)
  coins = list.coins
  if (changed) {
    paintCoins()
    paintClaim()
    paintClaims()
  }
  paintLiveNumbers(list.unclaimedSol)
}

loadDesk()
setInterval(refreshUnclaimed, 5000)
