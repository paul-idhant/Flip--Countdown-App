# FLIP — Cinematic Countdown

A premium Spotify-powered flip-clock countdown. No installation, no build step, works offline (except real Spotify data, which needs internet).

## 📁 What's inside

```
countdown/
├── index.html      ← open this
├── styles.css
├── README.md       ← this guide
└── js/
    ├── core.js         persistence + drift-free time engine
    ├── flip.js         split-flap cards + calendar Days card
    ├── spotify.js      real Spotify login (PKCE) + demo simulation
    ├── background.js   blurred-artwork atmosphere + ambient light
    └── ui.js           creator, list, Now Playing, fullscreen, settings
```

## 🖥️ Run it on your PC

**Option A — double-click (easiest)**
1. Copy the whole `countdown` folder to your PC.
2. Double-click `index.html`. It opens in your browser and just works.
3. Limitation: real Spotify login does **not** work from a file (Spotify can't redirect back to one). Demo mode works fully.

**Option B — tiny local server (recommended, needed for real Spotify)**
1. Open a terminal/command prompt **inside** the `countdown` folder.
2. Run **one** of these:
   - Node/npm (easiest on Windows): `npm run dev` — no `npm install` needed, zero dependencies
   - Python: `python -m http.server 8000`
   - VS Code: install "Live Server", right-click `index.html` → "Open with Live Server"
   
   Or on Windows just double-click **`Start-Flip-Countdown.bat`** — it starts the server and opens your browser.
3. Open the URL it shows, e.g. **http://localhost:8000**
4. Keep that window running while you use the app.

## 🎵 Connect real Spotify (free, one-time, ~5 minutes)

1. Go to **https://developer.spotify.com/dashboard** and log in with your Spotify account.
2. Click **Create app** → name it `Flip Countdown` → agree → Create. (Personal use needs no approval.)
3. Inside the app, open **Settings** → find **Redirect URIs** → **Add** your exact app URL, e.g.:
   - `http://localhost:8000/` (note the trailing `/`)
   
   It must match **character-for-character** what you see in the Flip settings box — `localhost` vs `127.0.0.1`, port, and trailing slash all matter. Click **Save**.
4. Copy the **Client ID** shown on the dashboard.
5. In Flip: click the ⚙️ gear → **Spotify background** → **Real** → paste Client ID + Redirect URI → **Connect with Spotify** → Agree.
6. The setup dialog closes itself. **Play any song** on Spotify (phone or desktop app). Within ~5 seconds the Flip background melts into your album artwork.

**Notes**
- Music must actually be **playing** for the live background (a paused track keeps its art; nothing playing → calm neutral background).
- Works with free and Premium accounts (the app only *reads* what's playing).
- Login uses PKCE — no server, no secrets; tokens stay in your browser only.
- To disconnect: gear → Spotify → Off (or Disconnect).

## 🚀 Put it on the internet (Vercel / GitHub Pages)

The app is 100% static — it deploys as-is, no build step, no config files needed.

**Vercel (easiest)**
1. Push this folder to a GitHub repo (or run `npx vercel` inside the folder and follow the prompts).
2. vercel.com → Add New → Project → Import the repo → Deploy.
3. You get `https://your-project.vercel.app/`.

**GitHub Pages (free forever)**
1. Push this folder's contents to a repo (at the root of the repo).
2. Repo → Settings → Pages → Source: Deploy from branch → Branch: main, folder: `/ (root)` → Save.
3. You get `https://<you>.github.io/<repo>/`.

**Then re-link Spotify for the hosted URL**
1. developer.spotify.com/dashboard → your app → Settings → Redirect URIs → **Add** your hosted URL **with trailing `/`**, e.g. `https://your-project.vercel.app/` → Save. (Keep `http://localhost:8000/` too — multiple URIs are allowed.)
2. Open the hosted app → gear → Spotify → Real → paste the same Client ID → the Redirect URI box auto-fills the hosted URL → Connect.

Notes: Spotify requires `https` for non-localhost URLs — both hosts provide it automatically. Countdowns are stored per-browser, and anyone opening a public link needs their own Spotify Client ID to enable *their* live background.

## ✨ No setup? Use Demo mode

Gear → **Spotify background** → **Demo**. It simulates Spotify with generated artwork in blue / crimson / violet / emerald. The dialog closes itself and the countdown is always 100% real.

## ⌨️ Shortcuts

| Key | Action |
|-----|--------|
| `N` | New countdown |
| `F` | Fullscreen focus mode |
| `Esc` | Close dialog / exit focus |

Countdowns and settings are stored in your browser (localStorage) — they survive refreshes and restarts on the same PC + browser.
