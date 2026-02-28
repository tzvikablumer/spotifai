# 🎵 spotif.ai — AI Music Generation Studio

A self-hosted, Spotify-inspired platform where you **generate music with AI** and build your own dream music library.

- **Sonauto** generates original songs from text descriptions
- **Nano Banana (Gemini)** creates unique cover art for each track
- Beautiful Spotify-like UI with player, search, artist/album browsing
- Mobile-friendly responsive design
- One-command Docker deployment

## Quick Start

### 1. Set up API keys

```bash
cp .env.example .env
# Edit .env with your API keys:
# SONAUTO_API_KEY=your_key
# GEMINI_API_KEY=your_key  
```

### 2. Run locally

```bash
npm install
node server.js
# Open http://localhost:3000
```

### 3. Or use Docker

```bash
docker compose up --build
# Open http://localhost:3000
```

## Creating Songs

Click **✨ Create Song** and fill in:
- **Artist Name** — the virtual artist
- **Song Title** — name of the track
- **Song Description** — describe the vibe, genre, mood
- **Genre Tags** — comma-separated style tags (optional)
- **Cover Art Description** — describe the visual art (optional)
- **Instrumental** — check for no vocals

The song will generate in 1-3 minutes. You'll see a spinner while it's cooking.

## Cloud Deployment

### Railway / Render
1. Push to GitHub
2. Connect repository
3. Set environment variables (`SONAUTO_API_KEY`, `GEMINI_API_KEY`)
4. Deploy — done!

### VPS (Hetzner, DigitalOcean)
```bash
git clone <repo> && cd dreamify
cp .env.example .env  # edit with your keys
docker compose up -d
```

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Music AI | Sonauto API |
| Art AI | Gemini (Nano Banana) |
| Frontend | Vanilla HTML/CSS/JS |
| Deploy | Docker |
