# GitLaunch

<p align="center">
  <img src="logo.png" alt="GitLaunch" width="220" />
</p>

<p align="center">
  Launch a coin for a GitHub account.<br />
  <a href="https://usegitlaunch.fun">usegitlaunch.fun</a>
</p>

The coin lists on GitLaunch. The master wallet creates it on Launch and stays the dev on the chart. GitHub's numeric user id is who can claim. A rename still matches.

## Fees

A trade is 3%.

- **1%** buys the launched coin and burns it. That buy shows as the dev.
- **1%** is burned by the platform.
- **1%** accrues to the GitHub id. Claim sends that balance to a Solana wallet. Later trades start a new balance.

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

The ledger in this build is stored in the browser. GitHub sign-in is a public user lookup, not an OAuth app. The master wallet has not signed a create or a payout.
