const KEY = 'gitlaunch-v1'
const FEE = 0.01
const DEMO_CA = 'GitLaunchDemoCA111111111111111111111111'

const $ = (id) => document.getElementById(id)

let state = load()
let timer = 0
let logoData = ''

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '')
    if (Array.isArray(saved?.coins)) {
      saved.session = saved.session || null
      for (const coin of saved.coins) {
        if (!coin.ca && coin.ticker === 'DEMO') coin.ca = DEMO_CA
        if (!coin.ca) coin.ca = ''
        coin.twitter ||= ''
        coin.website ||= ''
        coin.logo ||= ''
      }
      return saved
    }
  } catch {
    // A fresh desk starts on the demo coin.
  }
  return {
    session: null,
    coins: [
      {
        ticker: 'DEMO',
        name: 'Demo',
        ca: DEMO_CA,
        github: 'demo',
        githubId: 0,
        twitter: '',
        website: '',
        logo: '',
        unclaimed: 0.24,
        claimed: 0,
        claims: [],
      },
    ],
    selected: 'DEMO',
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state))
  paint()
}

function sol(n) {
  return (Math.round(n * 10000) / 10000).toFixed(4)
}

function walletOk(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim())
}

function shortCa(ca) {
  if (!ca) return 'no CA'
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

async function githubUser(login) {
  const name = login.trim().replace(/^@/, '')
  if (!/^[A-Za-z0-9-]+$/.test(name)) throw new Error('Enter a GitHub username')
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(name)}`)
  if (response.status === 404) throw new Error('No GitHub account with that name')
  if (!response.ok) throw new Error('GitHub did not answer')
  const user = await response.json()
  return { login: user.login, id: user.id }
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

function owned() {
  if (!state.session) return []
  return state.coins.filter((coin) => coin.githubId === state.session.id)
}

function selectedCoin() {
  return state.coins.find((coin) => coin.ticker === state.selected) || owned()[0] || null
}

function paintClaim() {
  if (!$('session')) return
  const session = state.session
  $('session').textContent = session
    ? `@${session.login} · id ${session.id}`
    : 'Not signed in'
  $('signin').hidden = !!session
  $('signed').hidden = !session
  const coins = owned()
  const select = $('coins')
  select.innerHTML = coins.map((coin) => {
    const mark = coin.ticker === state.selected ? ' selected' : ''
    const tag = coin.ca ? shortCa(coin.ca) : `id ${coin.githubId}`
    return `<option value="${coin.ticker}"${mark}>${coin.ticker} · ${tag} · @${coin.github}</option>`
  }).join('')
  const coin = selectedCoin()
  if (!coin || !session || coin.githubId !== session.id) {
    $('calink').textContent = ''
    $('unclaimed').textContent = '0.0000'
    $('accrual').textContent = coins.length ? '' : 'No coin is paying this GitHub account yet.'
    $('history').innerHTML = ''
    $('claim-go').disabled = true
    return
  }
  $('calink').textContent = coin.ca
    ? `${coin.ca} linked to @${coin.github} · id ${coin.githubId}`
    : `Linked to @${coin.github} · id ${coin.githubId}`
  $('unclaimed').textContent = sol(coin.unclaimed)
  $('accrual').textContent = coin.githubId === 0
    ? 'Demo trades keep adding the treasury 1%. Claim, then watch the next trades start again.'
    : 'New trades add the treasury 1% after a claim.'
  $('claim-go').disabled = coin.unclaimed <= 0
  $('history').innerHTML = coin.claims.slice(0, 6).map((claim) =>
    `<li><span>${sol(claim.amount)} SOL → ${claim.wallet.slice(0, 4)}…${claim.wallet.slice(-4)}</span><span>master wallet</span></li>`,
  ).join('')
}

function paintCoins() {
  const list = $('coins-list')
  if (!list) return
  const coins = state.coins
  $('coin-count').textContent = String(coins.length)
  $('coins-empty').hidden = coins.length > 0
  list.innerHTML = coins.map((coin) => {
    const logo = safeLogo(coin.logo)
    const face = logo
      ? `<img src="${logo}" alt="" />`
      : `<b>${escapeHtml(coin.ticker.slice(0, 1))}</b>`
    const links = [linkHtml(twitterLink(coin.twitter)), linkHtml(webLink(coin.website))].filter(Boolean).join(' · ')
    return `<li>
      <span class="face">${face}</span>
      <span>
        <strong>${escapeHtml(coin.ticker)}</strong>
        <span class="who">${escapeHtml(coin.name)} · @${escapeHtml(coin.github)} · id ${coin.githubId}</span>
        <span class="links">${links || 'On Launch'}</span>
      </span>
      <span class="bal">${sol(coin.unclaimed)} SOL</span>
    </li>`
  }).join('')
}

function paint() {
  paintClaim()
  paintCoins()
}

function armDemo() {
  clearInterval(timer)
  timer = 0
  if (state.session?.id !== 0 || !$('unclaimed')) return
  timer = setInterval(() => {
    const demo = state.coins.find((coin) => coin.ticker === 'DEMO')
    if (!demo) return
    demo.unclaimed = Math.round((demo.unclaimed + 0.01) * 10000) / 10000
    save()
  }, 1600)
}

function signIn(user) {
  state.session = user
  const mine = state.coins.find((coin) => coin.githubId === user.id)
  state.selected = mine?.ticker || state.selected
  armDemo()
  save()
  say(user.id === 0 ? 'Demo claim is open.' : `Signed in as @${user.login}.`)
}

if ($('signin')) {
  $('signin').addEventListener('submit', async (event) => {
    event.preventDefault()
    say('Checking GitHub…')
    try {
      const user = await githubUser($('github').value)
      signIn(user)
    } catch (error) {
      say(error.message || 'GitHub did not answer')
    }
  })
}

if ($('demo')) {
  $('demo').addEventListener('click', () => {
    signIn({ login: 'demo', id: 0 })
  })
}

if ($('coins')) {
  $('coins').addEventListener('change', () => {
    state.selected = $('coins').value
    save()
  })
}

if ($('claim-form')) {
  $('claim-form').addEventListener('submit', (event) => {
    event.preventDefault()
    const coin = selectedCoin()
    const wallet = $('wallet').value.trim()
    if (!coin || coin.githubId !== state.session?.id) return
    if (!walletOk(wallet)) {
      say('Enter the Solana wallet that should receive the claim.')
      return
    }
    if (coin.unclaimed <= 0) {
      say('Nothing has accrued yet.')
      return
    }
    const amount = coin.unclaimed
    coin.claims.unshift({ amount, wallet, at: Date.now() })
    coin.claimed = Math.round((coin.claimed + amount) * 10000) / 10000
    coin.unclaimed = 0
    save()
    say(`Claimed ${sol(amount)} SOL. The master wallet pays ${wallet}. The next trades start a new balance.`)
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
    const name = $('name').value.trim()
    const ticker = $('ticker').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const ownerName = $('owner').value.trim()
    const twitter = $('twitter').value.trim()
    const website = $('website').value.trim()
    const launched = (text) => {
      $('launch-note').textContent = text
    }
    if (!name || ticker.length < 2) {
      launched('Add a name and a ticker.')
      return
    }
    if (!ownerName) {
      launched('Add the GitHub account the fees should go to.')
      return
    }
    if (state.coins.some((coin) => coin.ticker === ticker)) {
      launched('That ticker is already launched.')
      return
    }
    launched('Checking the GitHub account…')
    try {
      const user = ownerName.replace(/^@/, '') === 'demo'
        ? { login: 'demo', id: 0 }
        : await githubUser(ownerName)
      state.coins.unshift({
        ticker,
        name,
        ca: '',
        github: user.login,
        githubId: user.id,
        twitter,
        website,
        logo: logoData,
        unclaimed: 0,
        claimed: 0,
        claims: [],
      })
      if (state.session?.id === user.id) state.selected = ticker
      logoData = ''
      $('name').value = ''
      $('ticker').value = ''
      $('owner').value = ''
      $('twitter').value = ''
      $('website').value = ''
      $('logo').value = ''
      $('logo-preview').hidden = true
      $('logo-preview').removeAttribute('src')
      save()
      launched(`${ticker} is on GitLaunch, linked to @${user.login} · id ${user.id}. The master wallet stays the dev on Launch. They sign in to claim.`)
    } catch (error) {
      launched(error.message || 'GitHub did not answer')
    }
  })
}

if ($('trade')) {
  $('trade').addEventListener('click', () => {
    const coin = selectedCoin()
    if (!coin || coin.githubId !== state.session?.id) return
    coin.unclaimed = Math.round((coin.unclaimed + FEE) * 10000) / 10000
    save()
    say(`1 SOL traded. ${sol(FEE)} SOL accrued to @${coin.github}.`)
  })
}

window.addEventListener('storage', () => {
  state = load()
  armDemo()
  paint()
})

armDemo()
paint()
