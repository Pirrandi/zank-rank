🌐 [Español](README.es.md) · **English**

<div align="center">

<img src="docs/logo.png" alt="zank.rank" width="440" />

**Your group. Your ranking.**

A League of Legends ranking for your friend group: rank, LP and streaks synced automatically from Riot,
a Discord bot that celebrates every rank-up (and exposes every rank-down), and a ton of stuff to fight about.

[**Try it at zank.lol**](https://zank.lol) · [Self-hosted with Docker](#-self-hosted-with-docker) · [What it does](#-what-it-does)

![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-SQLite-2d3748?logo=prisma)
![Docker](https://img.shields.io/badge/Docker-compose-2496ed?logo=docker&logoColor=white)

<img src="docs/screenshots/landing.jpg" alt="zank.rank landing page" width="900" />

</div>

---

## 📸 Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/ranking.jpg" alt="Ranking with podium" /><br /><sub><b>Ranking</b>: podium, LP gained, streaks and reactions.</sub></td>
    <td width="50%"><img src="docs/screenshots/profile.jpg" alt="Player profile" /><br /><sub><b>Profile</b>: LP history, matches, achievements and 1v1 comparison.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/muros.jpg" alt="Walls of fame and shame" /><br /><sub><b>Walls</b>: fame and shame, with AI-generated comments.</sub></td>
    <td width="50%"><img src="docs/screenshots/analisis.jpg" alt="Daily AI analysis" /><br /><sub><b>Analysis</b>: a daily AI-generated note per player.</sub></td>
  </tr>
</table>

## ✨ What it does

| | |
|---|---|
| 🏆 **Live ranking** | Sortable by rank or LP gained, with a top-3 podium, search, and Solo/Duo vs Flex. |
| 📈 **Per-player profile** | LP chart (7 and 30 days), recent matches with who they played with, achievements, and 1v1 comparison against anyone in the group. |
| 🟢 **Live + betting** | Who's playing right now, with a timer. Bet ZankCoins from the web or from Discord on a win or a loss: pays 2x. |
| ⚔️ **Versus** | Detects when two or more of the group land on rival teams in a custom game and keeps the "versus kings" table. |
| 🧱 **Walls** | Fame (pentakills, quadras, objective steals) and shame (losing streaks, LP crashes), with reactions. |
| 🤖 **Discord bot + AI** | Announces rank-ups and rank-downs with a card and an AI-generated roast. `/rank` to check, `/agregar-jugador` to add accounts. |
| 🧠 **Daily analysis** | Every day, an AI-generated write-up for each player. |


## 🐳 Self-hosted with Docker

> **New:** the Docker setup is recent. If something breaks, [open an issue](https://github.com/pirrandi/zank.rank/issues).

Spins up the full self-hosted edition: the web app, the periodic Riot sync and the daily analysis,
with the SQLite database stored in the `zank-data` volume.

**You'll need:** Docker with Compose v2 and a [Riot API key](https://developer.riotgames.com/).

**1. Clone the repo**

```bash
git clone https://github.com/pirrandi/zank.rank.git && cd zank.rank
```

**2. Create the `.env`** and fill it in. At minimum, `RIOT_API_KEY` and `SESSION_SECRET` (e.g. `openssl rand -hex 32`):

```bash
cp .env.example .env
```

**3. Generate the admin panel password** and paste the `ADMIN_PASSWORD_HASH="..."` line into the `.env`:

```bash
docker compose run --rm --no-deps --entrypoint npm app run hash-admin-password -- 'your-password'
```

**4. Spin everything up**

```bash
docker compose up -d
```

The web app comes up at `http://localhost:3000` and the panel at `/admin`. On startup, the `app` service creates
or updates the database and the root ranking. The `scheduler` service starts syncing once `app` is ready.
To check the logs: `docker compose logs -f`.

<details>
<summary><b>Environment variables</b></summary>

| Variable | Default | What for |
|---|---|---|
| `RIOT_API_KEY` | — | **Required.** [developer.riotgames.com](https://developer.riotgames.com/). The development key expires every 24h. |
| `SESSION_SECRET` | — | **Required.** A long random string to sign the session. |
| `ADMIN_PASSWORD_HASH` | — | Hash of the `/admin` password (step 3). |
| `GROQ_API_KEY` | — | Roasts and AI analysis ([console.groq.com](https://console.groq.com/keys)). No key, no AI text. |
| `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_CHANNEL_ID` | — | Discord bot. |
| `DISCORD_RANKUP_CHANNEL_ID` | — | Optional: a channel just for rank-change alerts. |
| `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID` | — | Only needed to register the slash commands. |
| `POLL_INTERVAL_MINUTES` | `5` | How often it syncs with Riot. |
| `ANALYZE_HOUR` | `12` | Hour (0-23) for the daily analysis. |
| `TZ` | `UTC` | Timezone, e.g. `America/Argentina/Buenos_Aires`. |
| `PORT` | `3000` | Host port the web app is published on. |

`ZANK_EDITION` and `DATABASE_URL` are set by `docker-compose.yml`, so whatever the `.env` says for those two doesn't apply.

</details>

<details>
<summary><b>Accounts, Discord bot, updating and backup</b></summary>

**Add accounts:** from `/admin`, or with

```bash
docker compose exec app npm run add-account -- <name> <tag>
```

**Discord bot:**

1. Create an application in the [Developer Portal](https://discord.com/developers/applications), add a bot to it, and copy the token.
2. In OAuth2 → URL Generator, check `bot` and `applications.commands`, with permissions to read and send messages, and invite it to your server.
3. Copy the `verify_key` from General Information into `DISCORD_PUBLIC_KEY`.
4. Register `/rank` and `/agregar-jugador`:
   ```bash
   docker compose exec app npm run register-discord-command
   ```
5. In the Developer Portal, set the **Interactions Endpoint URL** to `https://your-domain/api/discord/interactions`.
   Discord requires HTTPS, so you'll need a reverse proxy with a certificate in front of it (there's an nginx example in `deploy/`).

The alert channels can also be set from `/admin/settings`, and whatever's saved there takes priority over the `.env`.

**Updating:**

```bash
git pull && docker compose up -d --build
```

**Backup:** a copy is kept at `/data/zank.db.bak` on every startup. For a full volume backup:

```bash
docker compose stop
docker run --rm -v <volume>:/data -v "$PWD":/backup busybox tar czf /backup/zank-data.tgz -C /data .
docker compose start
```

Replace `<volume>` with the real name (it ends in `_zank-data`); you can find it with `docker volume ls`.

</details>

<details>
<summary><b>Without Docker (Node + cron)</b></summary>

```bash
npm install
npx prisma db push                               # creates the SQLite database
npm run migrate-rankings                         # creates the root ranking
npm run add-account -- <name> <tag>              # e.g.: npm run add-account -- Faker KR1
npm run build && npm start -- -p 3000
```

Sync and analysis with cron:

```
*/5 * * * *  cd /path/to/project && env $(cat .env | xargs) npx tsx scripts/poll.ts >> poll.log 2>&1
0 12 * * *   cd /path/to/project && env $(cat .env | xargs) npx tsx scripts/analyze.ts >> analyze.log 2>&1
```

</details>

## 🛠️ Adapting it to your group

It's set up for a group that plays on LAS. For a different region or server:

- **Region:** the `la2` platform is the default value in `scripts/add-account.ts`, in the form at `src/app/[slug]/admin/accounts/`, and in `/agregar-jugador` (`src/app/api/discord/interactions/route.ts`). Swap it for your [routing value](https://developer.riotgames.com/docs/lol#routing-values) (`na1`, `euw1`, etc.) and adjust the continental routing in `src/lib/riot.ts`.
- **Discord admin role:** `ADMIN_ROLE_ID` in `src/app/api/discord/interactions/route.ts`.
- **Domain:** `metadataBase` in `src/app/layout.tsx`.

## 🧱 Stack

Next.js 15 (App Router) · React 19 · TypeScript · Prisma + SQLite · Discord Interactions · Groq.
The only external dependencies are the [Riot](https://developer.riotgames.com/), [Discord](https://discord.com/developers/applications) and [Groq](https://console.groq.com/keys) APIs.

---

<sub>zank.rank is not affiliated with or endorsed by Riot Games. League of Legends is a registered trademark of Riot Games, Inc.</sub>
