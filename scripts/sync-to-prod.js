#!/usr/bin/env node
/**
 * Sync tracks from local dev → production.
 *
 * Usage:
 *   npm run sync -- --artist "Artist Name"     # sync all tracks by artist
 *   npm run sync -- --album "Album Name"       # sync all tracks in album
 *   npm run sync -- --track 42                 # sync a single track by ID
 *   npm run sync -- --all                      # sync everything
 *   npm run sync                               # interactive menu
 *
 * Env vars (from .env):
 *   PROD_URL     – production base URL (e.g. https://your-app.up.railway.app)
 *   SYNC_SECRET  – shared secret for authentication
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Database = require('better-sqlite3');

const PROD_URL = (process.env.PROD_URL || '').replace(/\/$/, '');
const SYNC_SECRET = process.env.SYNC_SECRET || '';
const DB_PATH = process.env.DB_PATH || './data/dreamify.db';

if (!PROD_URL) { console.error('❌ PROD_URL not set in .env'); process.exit(1); }
if (!SYNC_SECRET) { console.error('❌ SYNC_SECRET not set in .env'); process.exit(1); }

const db = new Database(DB_PATH, { readonly: true });

// ── Helpers ────────────────────────────────────────────────────────

function getTracks(where = "status = 'ready'", params = []) {
    return db.prepare(`SELECT * FROM tracks WHERE ${where} ORDER BY artist, album, track_number, id`).all(...params);
}

function getArtistPhoto(artist) {
    return db.prepare('SELECT * FROM artist_photos WHERE artist = ?').get(artist);
}

async function syncTrack(track) {
    const form = new FormData();

    // Metadata
    const artistPhoto = getArtistPhoto(track.artist);
    const meta = {
        title: track.title,
        artist: track.artist,
        album: track.album,
        genre: track.genre,
        prompt: track.prompt,
        tags: track.tags,
        art_prompt: track.art_prompt,
        instrumental: track.instrumental,
        track_number: track.track_number,
        duration: track.duration,
        lyrics: track.lyrics || '',
        lyrics_aligned: track.lyrics_aligned || '',
        cover_path: track.cover_path || '',
        artist_photo_path: artistPhoto?.photo_path || '',
    };
    form.append('metadata', JSON.stringify(meta));

    // Audio file
    if (track.file_path && fs.existsSync(path.resolve(track.file_path))) {
        const audioBlob = new Blob([fs.readFileSync(path.resolve(track.file_path))]);
        form.append('audio', audioBlob, path.basename(track.file_path));
    }

    // Cover image
    if (track.cover_path && fs.existsSync(path.resolve(track.cover_path))) {
        const coverBlob = new Blob([fs.readFileSync(path.resolve(track.cover_path))]);
        form.append('cover', coverBlob, path.basename(track.cover_path));
    }

    // Artist photo (only once per artist, tracked below)
    if (artistPhoto?.photo_path && fs.existsSync(path.resolve(artistPhoto.photo_path))) {
        const photoBlob = new Blob([fs.readFileSync(path.resolve(artistPhoto.photo_path))]);
        form.append('artist_photo', photoBlob, path.basename(artistPhoto.photo_path));
    }

    const res = await fetch(`${PROD_URL}/api/sync/import`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SYNC_SECRET}` },
        body: form,
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
}

// ── Interactive Menu ───────────────────────────────────────────────

async function interactiveMenu() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(r => rl.question(q, r));

    console.log('\n🎵 spotif.ai Sync Tool\n');
    console.log(`  Target: ${PROD_URL}\n`);

    const artists = db.prepare(`
        SELECT artist, COUNT(*) as count FROM tracks 
        WHERE status = 'ready' GROUP BY artist ORDER BY artist
    `).all();

    console.log('Artists:');
    artists.forEach((a, i) => console.log(`  ${i + 1}. ${a.artist} (${a.count} tracks)`));
    console.log(`  ${artists.length + 1}. [Sync ALL]`);
    console.log('');

    const choice = await ask('Pick an artist (number) or "q" to quit: ');
    if (choice.toLowerCase() === 'q') { rl.close(); return; }

    const idx = parseInt(choice) - 1;

    let tracks;
    if (idx === artists.length) {
        tracks = getTracks();
    } else if (idx >= 0 && idx < artists.length) {
        const artistName = artists[idx].artist;

        // Show albums for this artist
        const albums = db.prepare(`
            SELECT album, COUNT(*) as count FROM tracks 
            WHERE artist = ? AND status = 'ready' AND album != ''
            GROUP BY album ORDER BY album
        `).all(artistName);

        if (albums.length > 0) {
            console.log(`\nAlbums by ${artistName}:`);
            albums.forEach((a, i) => console.log(`  ${i + 1}. ${a.album} (${a.count} tracks)`));
            console.log(`  ${albums.length + 1}. [All tracks by ${artistName}]`);
            console.log('');

            const albumChoice = await ask('Pick an album (number): ');
            const albumIdx = parseInt(albumChoice) - 1;

            if (albumIdx === albums.length) {
                tracks = getTracks("artist = ? AND status = 'ready'", [artistName]);
            } else if (albumIdx >= 0 && albumIdx < albums.length) {
                tracks = getTracks("artist = ? AND album = ? AND status = 'ready'", [artistName, albums[albumIdx].album]);
            } else {
                console.log('Invalid choice.'); rl.close(); return;
            }
        } else {
            tracks = getTracks("artist = ? AND status = 'ready'", [artistName]);
        }
    } else {
        console.log('Invalid choice.'); rl.close(); return;
    }

    rl.close();
    await syncTracks(tracks);
}

// ── Batch Sync ─────────────────────────────────────────────────────

async function syncTracks(tracks) {
    if (tracks.length === 0) { console.log('No tracks to sync.'); return; }

    console.log(`\n📤 Syncing ${tracks.length} track(s) to ${PROD_URL}...\n`);

    let ok = 0, skipped = 0, fail = 0;
    const seenArtists = new Set();

    for (const track of tracks) {
        const label = `  "${track.title}" by ${track.artist}`;
        try {
            // Skip artist photo for artists we've already synced
            if (seenArtists.has(track.artist)) {
                track._skipArtistPhoto = true;
            }
            seenArtists.add(track.artist);

            const result = await syncTrack(track);
            if (result.skipped) {
                console.log(`⏭️${label} (already exists, id=${result.id})`);
                skipped++;
            } else {
                console.log(`✅${label} → id=${result.id}`);
                ok++;
            }
        } catch (err) {
            console.log(`❌${label} — ${err.message}`);
            fail++;
        }
    }

    console.log(`\n🏁 Done: ${ok} synced, ${skipped} skipped, ${fail} failed.\n`);
}

// ── CLI Entry Point ────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);

    // Parse flags
    const flagIdx = (flag) => args.indexOf(flag);
    const flagVal = (flag) => { const i = flagIdx(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : null; };

    if (flagIdx('--all') >= 0) {
        return syncTracks(getTracks());
    }

    const artist = flagVal('--artist');
    if (artist) {
        return syncTracks(getTracks("artist = ? AND status = 'ready'", [artist]));
    }

    const album = flagVal('--album');
    if (album) {
        return syncTracks(getTracks("album = ? AND status = 'ready'", [album]));
    }

    const trackId = flagVal('--track');
    if (trackId) {
        return syncTracks(getTracks("id = ? AND status = 'ready'", [parseInt(trackId)]));
    }

    // No flags → interactive
    await interactiveMenu();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
