import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { NATIVE_MINT, createCloseAccountInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token'
import BN from 'bn.js'
import {
  LAUNCHPAD_PROGRAM,
  LaunchpadPool,
  PlatformConfig,
  Raydium,
  TxVersion,
  getPdaLaunchpadConfigId,
  getPdaCreatorVault,
  getPdaLaunchpadPoolId,
  getPdaPlatformId,
} from '@raydium-io/raydium-sdk-v2'
import { attributeCreatorFees, claimPayout, coinOwed } from './fees.js'

const PROGRAM = LAUNCHPAD_PROGRAM
const RAYDIUM_PLATFORM = new PublicKey('4Bu96XjU84XjPDSpveTVf6LYGCkfW5FK7SNkREWcEfV4')
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const RESERVE = 20_000_000
const MIN_CREATE = 200_000_000
// LaunchLab caps creator_fee_rate at 5000 (0.5%). Platform fee can be 10000 (1%).
export const CREATOR_FEE = 5_000
export const PLATFORM_FEE = 10_000

export function connection() {
  return new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed')
}

export function masterKey() {
  const raw = process.env.GITLAUNCH_MASTER_KEY
  if (!raw) throw new Error('The master wallet is not set.')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
}

export function devAddress() {
  return masterKey().publicKey.toBase58()
}

async function sdk() {
  return Raydium.load({
    connection: connection(),
    owner: masterKey(),
    cluster: 'mainnet',
    disableFeatureCheck: true,
    disableLoadToken: true,
  })
}

export async function devBalance() {
  const owner = masterKey()
  const lamports = await connection().getBalance(owner.publicKey)
  return { address: owner.publicKey.toBase58(), lamports }
}

function poolIdFor(mint) {
  return getPdaLaunchpadPoolId(PROGRAM, new PublicKey(mint), NATIVE_MINT).publicKey
}

export async function poolFees(mint) {
  const info = await connection().getAccountInfo(poolIdFor(mint))
  if (!info) return null
  const pool = LaunchpadPool.decode(info.data)
  return {
    platformFee: pool.platformFee.toString(),
    protocolFee: pool.protocolFee.toString(),
  }
}

export async function poolPlatformFee(mint) {
  const fees = await poolFees(mint)
  return fees ? fees.platformFee : null
}

export async function creatorVaultAmount(mintB = NATIVE_MINT) {
  const owner = masterKey()
  const vault = getPdaCreatorVault(PROGRAM, owner.publicKey, mintB).publicKey
  const balance = await connection().getTokenAccountBalance(vault)
  return BigInt(balance.value.amount)
}

export function owedForCoin(coin, platformFee) {
  const split = coinOwed({
    platformFee: platformFee || 0,
    creatorRate: coin.creatorFeeRate ?? CREATOR_FEE,
    platformRate: coin.platformFeeRate ?? PLATFORM_FEE,
    feeSeen: coin.feeSeen || 0,
    paidLamports: coin.paidLamports || 0,
  })
  return { feeSeen: Number(split.feeSeen), owed: Number(split.owed) }
}

export async function ensurePlatform(ledger) {
  const owner = masterKey()
  const derived = getPdaPlatformId(PROGRAM, owner.publicKey).publicKey
  const existing = await connection().getAccountInfo(derived)
  if (existing) return derived.toBase58()
  if (ledger.platformId) return ledger.platformId

  const raydium = await sdk()
  const sample = await raydium.connection.getAccountInfo(RAYDIUM_PLATFORM)
  if (!sample) throw new Error('Launch did not answer.')
  const sampleConfig = PlatformConfig.decode(sample.data)
  const created = await raydium.launchpad.createPlatformConfig({
    programId: PROGRAM,
    platformAdmin: owner.publicKey,
    platformClaimFeeWallet: owner.publicKey,
    platformLockNftWallet: owner.publicKey,
    platformVestingWallet: owner.publicKey,
    cpConfigId: sampleConfig.cpConfigId,
    transferFeeExtensionAuth: owner.publicKey,
    creatorFeeRate: new BN(CREATOR_FEE),
    feeRate: new BN(PLATFORM_FEE),
    migrateCpLockNftScale: {
      platformScale: new BN(0),
      creatorScale: new BN(0),
      burnScale: new BN(1_000_000),
    },
    name: 'GitLaunch',
    web: 'https://usegitlaunch.fun',
    img: 'https://usegitlaunch.fun/logo.png',
    txVersion: TxVersion.V0,
    computeBudgetConfig: { units: 400_000, microLamports: 50_000 },
  })
  await created.execute({ sendAndConfirm: true })
  return created.extInfo.platformId.toBase58()
}

export async function createCoin({ name, symbol, uri, platformId, pair }) {
  const owner = masterKey()
  const lamports = await connection().getBalance(owner.publicKey)
  if (lamports < MIN_CREATE) {
    const sol = (lamports / 1e9).toFixed(4)
    throw new Error(`The master wallet ${owner.publicKey.toBase58()} has ${sol} SOL. It needs about 0.2 SOL to create the coin on Launch.`)
  }
  const raydium = await sdk()
  const configId = getPdaLaunchpadConfigId(PROGRAM, NATIVE_MINT, 0, 0).publicKey
  const configAccount = await raydium.connection.getAccountInfo(configId)
  if (!configAccount) throw new Error('Launch config was not found.')
  const created = await raydium.launchpad.createLaunchpad({
    programId: PROGRAM,
    mintA: pair.publicKey,
    decimals: 6,
    name,
    symbol,
    migrateType: 'cpmm',
    uri,
    configId,
    platformId: new PublicKey(platformId),
    mintBDecimals: 9,
    mintBProgram: TOKEN_PROGRAM,
    txVersion: TxVersion.V0,
    slippage: new BN(100),
    buyAmount: new BN(1000),
    createOnly: true,
    extraSigners: [pair],
    computeBudgetConfig: { units: 600_000, microLamports: 100_000 },
  })
  const sent = await created.execute({ sequentially: true })
  const signature = sent.txIds?.[0] || sent.txId || ''
  return {
    ca: pair.publicKey.toBase58(),
    poolId: poolIdFor(pair.publicKey.toBase58()).toBase58(),
    signature,
    creatorFeeRate: CREATOR_FEE,
    platformFeeRate: PLATFORM_FEE,
  }
}

async function pullCreatorFees() {
  const owner = masterKey()
  try {
    const raydium = await sdk()
    const result = await raydium.launchpad.claimCreatorFee({
      programId: PROGRAM,
      mintB: NATIVE_MINT,
      txVersion: TxVersion.V0,
    })
    if (result?.execute) await result.execute({ sendAndConfirm: true })
  } catch {
    return 0n
  }
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, owner.publicKey)
  const wrapped = await connection().getTokenAccountBalance(ata).catch(() => null)
  if (!wrapped || BigInt(wrapped.value.amount) <= 0n) return 0n
  const before = BigInt(await connection().getBalance(owner.publicKey))
  const tx = new Transaction().add(createCloseAccountInstruction(ata, owner.publicKey, owner.publicKey))
  await sendAndConfirmTransaction(connection(), tx, [owner])
  const after = BigInt(await connection().getBalance(owner.publicKey))
  return after > before ? after - before : 0n
}

export async function payClaim({ coin, coins = [coin], destination, pot }) {
  const quoted = []
  for (const item of coins) {
    const fees = await poolFees(item.ca).catch(() => null)
    const protocol = BigInt(fees?.protocolFee || 0)
    let seen = item.protocolSeen
    if (seen == null) {
      const paid = BigInt(item.paidLamports || 0)
      const baseline = paid > 0n ? (paid * 2_500n) / BigInt(CREATOR_FEE) : 0n
      seen = Number(baseline > protocol ? protocol : baseline)
    }
    quoted.push({
      ticker: item.ticker,
      protocolFee: protocol.toString(),
      protocolSeen: seen || 0,
    })
  }
  let vault = null
  try {
    vault = await creatorVaultAmount()
  } catch {
    vault = null
  }
  const shares = attributeCreatorFees({ coins: quoted, vault, pot: pot || 0 })
  const owed = shares[coin.ticker] || 0n
  const feeSeen = BigInt(coin.paidLamports || 0) + owed
  if (owed <= 0n) throw new Error('Nothing has accrued yet.')
  const swept = await pullCreatorFees()
  const owner = masterKey()
  const balance = await connection().getBalance(owner.publicKey)
  const payout = claimPayout({
    owed: Number(owed),
    pot: pot || 0,
    swept,
    balance,
    reserve: RESERVE,
  })
  if (payout.pay <= 0n) throw new Error('The fee is not in the master wallet yet.')
  const tx = new Transaction().add(SystemProgram.transfer({
    fromPubkey: owner.publicKey,
    toPubkey: new PublicKey(destination),
    lamports: Number(payout.pay),
  }))
  const signature = await sendAndConfirmTransaction(connection(), tx, [owner])
  const quotedCoin = quoted.find((item) => item.ticker === coin.ticker)
  return {
    lamports: Number(payout.pay),
    signature,
    feeSeen: Number(feeSeen),
    pot: Number(payout.pot),
    protocolFee: quotedCoin?.protocolFee || '0',
  }
}
