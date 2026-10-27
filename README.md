# GitLaunch

<p align="center">
  <img src="logo.png" alt="GitLaunch" width="220" />
</p>

<p align="center">
  Launch a coin for a GitHub account.<br />
  <a href="https://usegitlaunch.fun">usegitlaunch.fun</a>
</p>

<p align="center">
  Official CA<br />
  <a href="https://solscan.io/token/3G3SLBmbpngX4aEZAngcGvUirNXnjcuAMEnHYJfYLAaB"><code>3G3SLBmbpngX4aEZAngcGvUirNXnjcuAMEnHYJfYLAaB</code></a>
</p>

The coin lists on GitLaunch. One master wallet creates every coin and stays the dev on the chart. Each coin remembers one GitHub numeric id. A rename still matches. Another coin does not share that claim.

## Fees

A trade splits three ways.

- **0.5%** is the creator fee. LaunchLab caps it there. It belongs to that coin's GitHub account. Claim sends what is actually there.
- **1%** is the platform fee. It stays with the master wallet, from every coin.
- **0.25%** is Raydium's protocol fee.

## Flow

1. Someone names the coin, the ticker, a GitHub account, a logo, Twitter, and a website. They do not have to be that GitHub user.
2. The site looks up the numeric id on GitHub.
3. The matching account claims by entering a Solana wallet. That request is the trigger for the master wallet to send the unclaimed balance once. The balance resets. New volume starts a new balance.

GitHub cannot hold SOL or SPL tokens. The destination is the wallet entered at claim time. Burns stay burns. The GitHub user never holds the creator key.

## Pages

- Home
- Launch
- Coins launched
- Claim

## Repo

Static site. `index.html`, `launch.html`, `coins.html`, `claim.html`, `app.js`, `styles.css`.

`logo.png` is the mark. `hero.png` is the homepage art. The arrow points up and to the right.

Sign-in is GitHub OAuth. The account that authorizes is the account that can claim. A launch is created on Launch by the master wallet. A claim pays the creator fee only when that fee is actually there.
