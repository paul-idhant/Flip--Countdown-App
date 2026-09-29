# FLIP — Cinematic Countdown

A focused web countdown built around one important moment. FLIP combines an animated split-flap clock, restrained visual themes, and an optional Spotify playlist in a responsive, distraction-free interface.

## Highlights

- One focused countdown at a time
- Duration or target date-and-time modes
- Animated split-flap display
- **Original**, **Tobacco**, and **Gallery** themes
- Official Spotify playlist embed
- Editorial landing page
- Browser persistence for countdown, playlist, and theme
- Fullscreen and reduced-motion support
- Portrait-friendly setup and landscape mobile countdown
- Static deployment with no backend, dependencies, or build step

## Deploy to Vercel

### From the Vercel dashboard

1. Push this repository to GitHub.
2. Open [vercel.com/new](https://vercel.com/new).
3. Import `paul-idhant/Flip--Countdown-App`.
4. Set **Framework Preset** to **Other** if Vercel does not select it automatically.
5. Leave **Build Command** empty.
6. Leave **Output Directory** empty.
7. Select **Deploy**.

Vercel serves `index.html` directly. No environment variables or Spotify API credentials are required.

### Updating the site

After the project is connected, every push to the production branch automatically creates a new deployment. Pull requests and non-production branches receive preview deployments.

## Using FLIP

1. Select **Open FLIP** or **Create countdown**.
2. Enter a title and optional description.
3. Choose a duration or future date and time.
4. Start the countdown.
5. Optionally open **Playlist** and paste a public Spotify playlist URL.
6. Open **Appearance** to switch themes.

Spotify controls embedded playback availability. Depending on the listener's account, browser, and region, tracks may be limited to short previews. FLIP does not bypass Spotify restrictions.

## Themes

| Theme | Character |
| --- | --- |
| **Original** | Midnight cinematic atmosphere |
| **Tobacco** | Near-black brown, muted bronze, and warm off-white |
| **Gallery** | Mineral white, archival forest ink, and quiet brass |

## Mobile behaviour

Setup screens stack vertically in portrait mode. When a countdown starts, FLIP requests landscape orientation where supported. Browsers that block orientation locking display a prompt asking the user to rotate the phone.

## Privacy

FLIP has no backend, analytics, account system, or tracking scripts. Countdown settings, playlist URL, and theme preference stay in the visitor's browser using `localStorage`.

## Project structure

```text
├── index.html    # Application markup
├── styles.css   # Layout, animation, responsive rules, and themes
├── app.js       # Countdown, Spotify embed, persistence, and UI logic
├── vercel.json  # Vercel static hosting configuration
└── README.md
```

## Developer

Designed and developed by **[paul-idhant](https://github.com/paul-idhant)**.

- [idhant-mu.vercel.app](https://idhant-mu.vercel.app/)
- [felina-one.vercel.app](https://felina-one.vercel.app/)
