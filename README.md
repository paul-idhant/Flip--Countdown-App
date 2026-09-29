# FLIP — Cinematic Countdown

A focused countdown experience built around one important moment. FLIP combines an animated split-flap clock, restrained visual themes, and an optional Spotify playlist in a responsive, distraction-free interface.

<p>
  <a href="https://idhant-mu.vercel.app/">Developer portfolio</a> ·
  <a href="https://felina-one.vercel.app/">Felina</a>
</p>

## Highlights

- One focused countdown at a time
- Countdown by duration or a specific date and time
- Animated split-flap display
- Three complete visual themes: **Original**, **Tobacco**, and **Gallery**
- Official Spotify playlist embed from a pasted playlist URL
- Dedicated editorial landing page
- Local browser persistence for the countdown, playlist, and theme
- Fullscreen mode and reduced-motion support
- Responsive setup experience for phones
- Landscape countdown presentation on mobile devices
- No third-party JavaScript dependencies or build process

## Run FLIP locally

### Windows

1. Download and extract the latest `Flip-Countdown-Local` ZIP.
2. Double-click `Start-Flip-Countdown.bat`.
3. FLIP will open at [http://localhost:8000](http://localhost:8000).
4. Keep the terminal window open while using the app.

### macOS, Linux, or a terminal on Windows

FLIP requires [Node.js](https://nodejs.org/) 14 or newer.

```bash
git clone https://github.com/paul-idhant/Flip--Countdown-App.git
cd Flip--Countdown-App
npm run dev
```

Then open [http://localhost:8000](http://localhost:8000).

No `npm install` step is necessary—the local server uses only Node.js built-in modules.

## Using the countdown

1. Select **Open FLIP** or **Create countdown** on the home page.
2. Enter a title and optional description.
3. Choose either:
   - **Duration** for an hours, minutes, and seconds timer; or
   - **Date & time** for a future event.
4. Select **Start countdown**.
5. Use **Edit timer** to change the active countdown or **Reset** to clear it.

On a phone, setup is arranged vertically for comfortable portrait use. Once the countdown starts, FLIP uses a horizontal presentation. If the browser cannot automatically request landscape orientation, the app asks the user to rotate the device.

## Spotify playlists

Select **Playlist**, paste a public Spotify playlist link, and choose **Add**. FLIP uses Spotify's official embedded player and does not request Spotify developer credentials.

Spotify controls playback availability. Depending on the listener's account, browser, and region, embedded tracks may be limited to short previews. FLIP does not bypass Spotify playback restrictions.

## Themes

Open the appearance button in the navigation to switch themes. The selection is saved automatically.

| Theme | Character |
| --- | --- |
| **Original** | FLIP's existing midnight cinematic atmosphere |
| **Tobacco** | Near-black brown, muted bronze, and warm off-white |
| **Gallery** | Mineral white, archival forest ink, and quiet brass |

Every theme adapts the countdown cards, controls, navigation, dialogs, labels, footer, and Spotify status.

## Keyboard controls

| Key | Action |
| --- | --- |
| `F` | Enter or exit fullscreen mode |
| `Esc` | Close an open setup or side panel |

## Local data and privacy

FLIP stores the countdown, selected theme, and Spotify playlist URL in the browser's `localStorage`. The project has no application backend, analytics, tracking scripts, or account system.

Clearing browser site data removes the locally saved settings.

## Project structure

```text
Flip--Countdown-App/
├── index.html                  # Application markup
├── styles.css                 # Layout, animations, and themes
├── app.js                     # Countdown, playlist, and UI logic
├── server.js                  # Zero-dependency local web server
├── package.json               # Local run commands
├── Start-Flip-Countdown.bat   # Windows launcher
└── README.md
```

## Browser support

FLIP is intended for current versions of Chrome, Edge, Firefox, and Safari. Fullscreen and orientation-lock behavior may vary by browser and operating system.

## Developer

Designed and developed by **[paul-idhant](https://github.com/paul-idhant)**.

- Portfolio: [idhant-mu.vercel.app](https://idhant-mu.vercel.app/)
- Featured work: [felina-one.vercel.app](https://felina-one.vercel.app/)

All commits in this project are authored under the `paul-idhant` GitHub identity.
