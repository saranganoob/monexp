# Putting MonEXP live (Render + MongoDB Atlas)

One Render **web service** runs everything: Express serves the API at `/api` and the built Angular
site for every other address. Data lives in **MongoDB Atlas**. Both have free plans.

| Piece | Service | Plan |
|---|---|---|
| App (Node + Express + Angular) | Render | Free (sleeps after 15 min idle – first open takes ~30–60 s) |
| Database | MongoDB Atlas | Free M0 (512 MB) |
| Address | `https://<name>.onrender.com`, or your own domain later | Free / domain cost |

What changes in production (`NODE_ENV=production`):
- Login cookies are HTTPS-only.
- **The demo OTP is always off** – password sign-in only.
- Sign-in attempts are limited (20 per IP per 15 minutes).
- Security headers (Content-Security-Policy etc.) are sent.
- The backend refuses to start if `MONGODB_URI` still points at `localhost`.

---

## 1. Before you start

- [ ] MongoDB Atlas cluster is **Active**, database user created, Network Access has `0.0.0.0/0`.
- [ ] Your connection string works (`mongosh "<string>" --eval "db.runCommand({ ping: 1 })"` → `{ ok: 1 }`)
      and ends in `.mongodb.net/monexp?...` (the database name `monexp`).
- [ ] The latest code is pushed to GitHub.

## 2. Create the service on Render

1. https://dashboard.render.com → **New +** → **Web Service**.
2. Connect GitHub if asked, then pick the **monexp** repository.
3. Fill in:

   | Field | Value |
   |---|---|
   | Name | `monexp` (becomes `monexp.onrender.com` if free) |
   | Branch | the branch you push to (e.g. `MonExp-Main`) |
   | Region | **Singapore** (closest to India) |
   | Runtime | **Node** |
   | Build Command | `npm run build` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

4. **Environment Variables** (Add Environment Variable for each):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `NODE_VERSION` | `24` |
   | `MONGODB_URI` | your Atlas connection string (with the real password) |
   | `JWT_SECRET` | click **Generate** (any long random text, 32+ characters) |
   | `ANTHROPIC_API_KEY` | *(optional)* your Claude key – only for Ask AI / Summarise |
   | `ANTHROPIC_MODEL` | *(optional)* `claude-sonnet-5-5` |

5. **Advanced → Health Check Path**: `/api/health`.
6. **Create Web Service**. The first build takes ~3–5 minutes. Watch the **Logs** – it's ready when you see
   `MonEXP API running`.

> Alternative: **New + → Blueprint** reads `render.yaml` from the repo and fills most of this in;
> you'll still be asked for `MONGODB_URI` (and optionally `ANTHROPIC_API_KEY`).

## 3. Create your login on the live database

On your Mac, in the `monEXP` folder (paste your Atlas string between the quotes):

```bash
MONGODB_URI="mongodb+srv://..." npm run create-user
```

Enter your email, mobile and a password. That account is only in the live database – it doesn't touch
your Mac's local data.

### Giving friends their own login

Each login has its **own, separate** tracker – friends never see your data, and you don't see theirs in the app.
For each friend, run the same command with their email and a temporary password:

```bash
MONGODB_URI="mongodb+srv://..." npm run create-user
```

They sign in, go to **Profile → Account → Change password**, and start with **Start a blank month**.
(As the owner of the Atlas database you can technically see everyone's data there – tell them.)

## 4. Open it

`https://monexp.onrender.com` (or whatever name Render shows) → sign in → you'll see
"Nothing planned for <this month> yet" → **Start a blank month** and enter your real data.

Works on your phone too: open the same address in Chrome/Safari.

## 5. Updating the live app

Push to the branch Render watches. Render rebuilds and redeploys automatically (~3–5 minutes).

## 6. Backups

The free Atlas plan has no automatic backups. Every week or so, on your Mac:

```bash
MONGODB_URI="mongodb+srv://..." npm run backup
```

This writes `backups/monexp-<date>.json` in the project folder (ignored by git – it contains your
data and your login's password hash, so keep it private). To put a backup back:

```bash
MONGODB_URI="mongodb+srv://..." npm run restore -- backups/monexp-<date>.json --yes
```

`restore` **replaces** the data in that database.

## 7. Using your own domain later (e.g. monexp.in)

1. Render → your service → **Settings → Custom Domains → Add** `monexp.in` (and `www.monexp.in`).
2. Render shows the DNS records to create. In GoDaddy: **My Products → monexp.in → DNS → Add** those
   records exactly.
3. Wait from a few minutes up to a few hours. Render adds HTTPS automatically.

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails | Open **Logs**, look for the first red error; check `NODE_VERSION=24`. |
| `MONGODB_URI points at localhost` | Set `MONGODB_URI` in Render → Environment. |
| `bad auth` / `Authentication failed` | Wrong password in `MONGODB_URI` (or special characters not URL-encoded). |
| `querySrv` / timeout | Atlas → Network Access must include `0.0.0.0/0`. |
| Page takes ~1 minute to open | Free plan was asleep. Normal; or upgrade to Starter. |
| Can't sign in | Create the user against the **live** database (step 3). |
