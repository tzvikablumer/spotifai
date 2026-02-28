require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, queries } = require('./db');
const sonauto = require('./services/sonauto');
const coverart = require('./services/coverart');
const albumPlanner = require('./services/albumPlanner');
const { alignLyrics } = require('./services/alignment');
const { parseFile } = require('music-metadata');

const app = express();
const PORT = process.env.PORT || 3000;
const MUSIC_DIR = process.env.MUSIC_DIR || './data/tracks';
const COVERS_DIR = process.env.COVERS_DIR || './data/covers';
const SYNC_SECRET = process.env.SYNC_SECRET || '';

// Ensure directories
fs.mkdirSync(MUSIC_DIR, { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Track Generation ────────────────────────────────────────────────

// Active polling intervals per track
const pollingIntervals = new Map();

app.post('/api/generate', async (req, res) => {
    try {
        const { title, artist, album, genre, prompt, tags, art_prompt, instrumental } = req.body;

        if (!title || !artist || !prompt) {
            return res.status(400).json({ error: 'title, artist, and prompt are required' });
        }

        // Insert track record as pending
        const result = queries.insertTrack.run({
            title,
            artist,
            album: album || title, // Default album to song title
            genre: genre || '',
            prompt,
            tags: Array.isArray(tags) ? tags.join(', ') : (tags || ''),
            art_prompt: art_prompt || '',
            instrumental: instrumental ? 1 : 0,
            track_number: 0,
            sonauto_task_id: '',
            status: 'pending',
        });

        const trackId = result.lastInsertRowid;

        // Start generation asynchronously
        startGeneration(trackId, { title, artist, prompt, tags, art_prompt, instrumental, genre });

        res.json({ id: trackId, status: 'pending', message: 'Generation started' });
    } catch (err) {
        console.error('Generate error:', err);
        res.status(500).json({ error: err.message });
    }
});

async function startGeneration(trackId, params) {
    try {
        // 1. Start music generation via Sonauto
        queries.updateTrackStatus.run({ id: trackId, status: 'generating', error_message: '' });

        const tagsArray = params.tags
            ? (Array.isArray(params.tags) ? params.tags : params.tags.split(',').map(t => t.trim()).filter(Boolean))
            : [];

        // Build a rich prompt: the song is BY this artist
        const fullPrompt = `A song by ${params.artist}, titled "${params.title}". ${params.prompt}`;

        const taskId = await sonauto.generateSong({
            prompt: fullPrompt,
            tags: tagsArray,
            instrumental: !!params.instrumental,
        });

        // Save the task ID
        db.prepare('UPDATE tracks SET sonauto_task_id = ? WHERE id = ?').run(taskId, trackId);

        // Log the generation job
        queries.insertJob.run({
            track_id: trackId,
            type: 'music',
            external_id: taskId,
            status: 'processing',
        });

        // 2. Start cover art generation in parallel (skip for album tracks — handled separately)
        if (!params.skipCover) {
            generateCoverForTrack(trackId, params);
        }

        // 3. Start polling for music completion
        startPolling(trackId, taskId);

    } catch (err) {
        console.error(`Generation failed for track ${trackId}:`, err);
        queries.updateTrackStatus.run({ id: trackId, status: 'failed', error_message: err.message });
    }
}

async function generateCoverForTrack(trackId, params) {
    try {
        queries.insertJob.run({
            track_id: trackId,
            type: 'cover',
            external_id: '',
            status: 'processing',
        });

        const coverPath = await coverart.generateCover({
            artistName: params.artist,
            songTitle: params.title,
            artPrompt: params.art_prompt,
            genre: params.genre,
            lyrics: params.lyrics || '',
        });

        queries.updateTrackCover.run({ id: trackId, cover_path: coverPath });
        console.log(`Cover art ready for track ${trackId}`);
    } catch (err) {
        console.error(`Cover art failed for track ${trackId}:`, err);
        // Generate placeholder as fallback
        const placeholder = coverart.generatePlaceholder(params.artist, params.title);
        queries.updateTrackCover.run({ id: trackId, cover_path: placeholder });
    }

    // Auto-generate artist photo if this artist doesn't have one yet
    try {
        const existing = queries.getArtistPhoto.get(params.artist);
        if (!existing) {
            console.log(`Generating artist photo for "${params.artist}"...`);
            const photoPath = await coverart.generateArtistPhoto(params.artist, params.genre);
            queries.insertArtistPhoto.run(params.artist, photoPath);
            console.log(`Artist photo ready for "${params.artist}"`);
        }
    } catch (err) {
        console.error(`Artist photo failed for "${params.artist}":`, err.message);
    }
}

function startPolling(trackId, taskId) {
    let attempts = 0;
    const maxAttempts = 120; // ~10 minutes at 5s intervals

    const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            pollingIntervals.delete(trackId);
            queries.updateTrackStatus.run({ id: trackId, status: 'failed', error_message: 'Generation timed out' });
            return;
        }

        try {
            // Status endpoint returns a plain string: "SUCCESS", "GENERATING", "FAILURE", etc.
            const status = await sonauto.checkStatus(taskId);
            console.log(`Track ${trackId} poll #${attempts}: ${status}`);

            if (status === 'SUCCESS') {
                clearInterval(interval);
                pollingIntervals.delete(trackId);

                // Fetch the full result to get song_paths
                queries.updateTrackStatus.run({ id: trackId, status: 'downloading', error_message: '' });
                const result = await sonauto.getGenerationResult(taskId);

                if (!result.song_paths || result.song_paths.length === 0) {
                    queries.updateTrackStatus.run({ id: trackId, status: 'failed', error_message: 'No song_paths in result' });
                    return;
                }

                // Download the first generated song
                const audioUrl = result.song_paths[0];
                const filename = `track_${trackId}_${Date.now()}.mp3`;
                const filePath = path.join(MUSIC_DIR, filename);

                await sonauto.downloadAudio(audioUrl, filePath);

                // Read actual duration from the downloaded file
                let duration = 0;
                try {
                    const metadata = await parseFile(filePath);
                    duration = metadata.format.duration || 0;
                } catch (e) {
                    console.warn(`Could not read duration for track ${trackId}:`, e.message);
                }

                queries.updateTrackFile.run({
                    id: trackId,
                    file_path: filePath,
                    duration,
                });

                // Save lyrics from generation result
                if (result.lyrics) {
                    queries.updateTrackLyrics.run({
                        id: trackId,
                        lyrics: result.lyrics,
                        lyrics_aligned: '',
                    });
                    console.log(`Lyrics saved for track ${trackId}`);
                }

                console.log(`Track ${trackId} ready: ${filePath}`);

                // Run local forced alignment if we have lyrics
                if (result.lyrics) {
                    runLocalAlignment(trackId, filePath, result.lyrics);
                }

            } else if (status === 'FAILURE') {
                clearInterval(interval);
                pollingIntervals.delete(trackId);
                // Fetch full result to get error_message
                try {
                    const result = await sonauto.getGenerationResult(taskId);
                    queries.updateTrackStatus.run({ id: trackId, status: 'failed', error_message: result.error_message || 'Generation failed' });
                } catch {
                    queries.updateTrackStatus.run({ id: trackId, status: 'failed', error_message: 'Generation failed' });
                }
            }
            // For all other statuses (RECEIVED, GENERATING, etc.) — just keep polling
        } catch (err) {
            console.error(`Polling error for track ${trackId}:`, err.message);
            // Continue polling on transient errors
            if (attempts > maxAttempts - 5) {
                clearInterval(interval);
                pollingIntervals.delete(trackId);
                queries.updateTrackStatus.run({ id: trackId, status: 'failed', error_message: err.message });
            }
        }
    }, 5000); // Poll every 5 seconds

    pollingIntervals.set(trackId, interval);
}

// ── Local Forced Alignment (Whisper) ────────────────────────────────

async function runLocalAlignment(trackId, audioPath, lyricsText) {
    try {
        console.log(`Starting local alignment for track ${trackId}...`);
        const words = await alignLyrics(path.resolve(audioPath), lyricsText);

        if (!words || words.length === 0) {
            console.log(`No alignment words produced for track ${trackId}`);
            return;
        }

        // Store alignment as { word_aligned_lyrics: [...], alignment_source: 'whisper' }
        const alignedData = JSON.stringify({
            word_aligned_lyrics: words,
            alignment_status: 'SUCCESS',
            alignment_source: 'whisper',
        });

        queries.updateTrackLyrics.run({
            id: trackId,
            lyrics: lyricsText,
            lyrics_aligned: alignedData,
        });
        console.log(`Local alignment saved for track ${trackId} (${words.length} words)`);
    } catch (err) {
        console.error(`Local alignment failed for track ${trackId}:`, err.message);
    }
}

// ── Generation Status ───────────────────────────────────────────────

app.get('/api/generate/:id/status', (req, res) => {
    const track = queries.getTrack.get(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    res.json({
        id: track.id,
        title: track.title,
        artist: track.artist,
        status: track.status,
        error_message: track.error_message,
        has_cover: !!track.cover_path,
    });
});

app.get('/api/pending', (req, res) => {
    const tracks = queries.getPendingTracks.all();
    res.json(tracks);
});

// ── Track Listing ───────────────────────────────────────────────────

// ── Lyrics Endpoints ────────────────────────────────────────────────

app.get('/api/tracks/:id/lyrics', (req, res) => {
    const track = queries.getTrack.get(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const hasLyrics = !!(track.lyrics && track.lyrics.trim());
    let alignedData = null;
    try {
        if (track.lyrics_aligned) alignedData = JSON.parse(track.lyrics_aligned);
    } catch (e) { /* invalid JSON */ }

    res.json({
        lyrics: track.lyrics || '',
        lyrics_aligned: alignedData,
        has_lyrics: hasLyrics,
        has_alignment: !!(alignedData && alignedData.alignment_status === 'SUCCESS' && Array.isArray(alignedData.word_aligned_lyrics) && alignedData.word_aligned_lyrics.length > 0),
        instrumental: !!track.instrumental,
    });
});

app.post('/api/tracks/:id/lyrics/fetch', async (req, res) => {
    try {
        const track = queries.getTrack.get(req.params.id);
        if (!track) return res.status(404).json({ error: 'Track not found' });

        let lyrics = track.lyrics || '';

        // If no lyrics yet, fetch from Sonauto
        if (!lyrics.trim() && track.sonauto_task_id) {
            const result = await sonauto.getGenerationResult(track.sonauto_task_id);
            lyrics = result.lyrics || '';
            queries.updateTrackLyrics.run({ id: track.id, lyrics, lyrics_aligned: '' });
        }

        if (!lyrics.trim()) {
            return res.json({ success: true, lyrics: '', has_lyrics: false, has_alignment: false });
        }

        // Run local forced alignment
        if (!track.file_path) {
            return res.json({ success: true, lyrics, has_lyrics: true, has_alignment: false });
        }

        console.log(`Running local alignment for track ${track.id}...`);
        const words = await alignLyrics(path.resolve(track.file_path), lyrics);
        const hasAlignment = words && words.length > 0;

        if (hasAlignment) {
            const alignedData = JSON.stringify({
                word_aligned_lyrics: words,
                alignment_status: 'SUCCESS',
                alignment_source: 'whisper',
            });
            queries.updateTrackLyrics.run({ id: track.id, lyrics, lyrics_aligned: alignedData });
            console.log(`Local alignment saved for track ${track.id} (${words.length} words)`);
        }

        res.json({
            success: true,
            lyrics,
            has_lyrics: true,
            has_alignment: hasAlignment,
        });
    } catch (err) {
        console.error('Lyrics fetch/align failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Auto-fix tracks with missing duration (backfill on access)
async function fixDuration(track) {
    if (track.duration > 0 || !track.file_path || track.status !== 'ready') return track;
    try {
        const metadata = await parseFile(path.resolve(track.file_path));
        const duration = metadata.format.duration || 0;
        if (duration > 0) {
            db.prepare('UPDATE tracks SET duration = ?, updated_at = datetime(?) WHERE id = ?').run(duration, new Date().toISOString(), track.id);
            track.duration = duration;
        }
    } catch (e) { /* ignore read errors */ }
    return track;
}

async function fixDurations(tracks) {
    return Promise.all(tracks.map(fixDuration));
}

app.get('/api/tracks', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const tracks = await fixDurations(queries.getTracksPaginated.all(limit, offset));
    const { count } = queries.getTrackCount.get();

    res.json({
        tracks,
        total: count,
        page,
        pages: Math.ceil(count / limit),
    });
});

app.get('/api/tracks/search', async (req, res) => {
    const q = req.query.q;
    if (!q || q.trim().length === 0) {
        return res.json({ tracks: [] });
    }

    try {
        // FTS5 query: add * for prefix matching
        const searchQuery = q.trim().split(/\s+/).map(w => `"${w}"*`).join(' ');
        const tracks = await fixDurations(queries.searchTracks.all(searchQuery));
        res.json({ tracks });
    } catch (err) {
        // Fallback: simple LIKE query if FTS fails
        const tracks = await fixDurations(db.prepare(`
      SELECT * FROM tracks 
      WHERE status = 'ready' AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)
      LIMIT 50
    `).all(`%${q}%`, `%${q}%`, `%${q}%`));
        res.json({ tracks });
    }
});

app.get('/api/tracks/:id', async (req, res) => {
    const track = queries.getTrack.get(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    res.json(await fixDuration(track));
});

// ── Artists ─────────────────────────────────────────────────────────

app.get('/api/artists', (req, res) => {
    const artists = queries.getArtists.all();
    res.json(artists);
});

app.get('/api/artists/:name/tracks', (req, res) => {
    const tracks = queries.getTracksByArtist.all(decodeURIComponent(req.params.name));
    res.json(tracks);
});

app.get('/api/artists/:name/albums', (req, res) => {
    const artistName = decodeURIComponent(req.params.name);
    const albums = db.prepare(`
        SELECT album, artist, COUNT(*) as track_count,
               MIN(cover_path) as cover_path, MIN(id) as id,
               MAX(updated_at) as updated_at
        FROM tracks WHERE status = 'ready' AND album != '' AND artist = ?
        GROUP BY album ORDER BY MAX(updated_at) DESC
    `).all(artistName);
    res.json(albums);
});

// ── Albums ──────────────────────────────────────────────────────────

app.get('/api/albums', (req, res) => {
    const albums = db.prepare(`
        SELECT album, artist, COUNT(*) as track_count,
               MIN(cover_path) as cover_path, MIN(id) as id,
               MAX(updated_at) as updated_at
        FROM tracks WHERE status = 'ready' AND album != ''
        GROUP BY album, artist ORDER BY album
    `).all();
    res.json(albums);
});

app.get('/api/albums/:name/tracks', (req, res) => {
    const artist = req.query.artist ? decodeURIComponent(req.query.artist) : null;
    if (!artist) {
        return res.status(400).json({ error: 'artist query parameter is required' });
    }
    const tracks = queries.getTracksByAlbum.all(decodeURIComponent(req.params.name), artist);
    res.json(tracks);
});

// ── Audio Streaming ─────────────────────────────────────────────────

app.get('/api/stream/:id', (req, res) => {
    const track = queries.getTrack.get(req.params.id);
    if (!track || !track.file_path) {
        return res.status(404).json({ error: 'Track not found or not ready' });
    }

    const filePath = path.resolve(track.file_path);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio file not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'audio/mpeg',
        });
        file.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
        });
        fs.createReadStream(filePath).pipe(res);
    }
});

// ── Cover Art ───────────────────────────────────────────────────────

app.get('/api/cover/:id', (req, res) => {
    const track = queries.getTrack.get(req.params.id);
    if (!track || !track.cover_path) {
        return res.status(404).json({ error: 'Cover not found' });
    }

    const coverPath = path.resolve(track.cover_path);
    if (!fs.existsSync(coverPath)) {
        return res.status(404).json({ error: 'Cover file not found' });
    }

    const ext = path.extname(coverPath).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'image/png');
    // Use ETag based on file path so regenerated covers bust cache
    const etag = `"${Buffer.from(track.cover_path).toString('base64')}"`;
    res.setHeader('ETag', etag);
    // no-cache: browser must revalidate every time (ETag will short-circuit if unchanged)
    res.setHeader('Cache-Control', 'no-cache');

    if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
    }

    fs.createReadStream(coverPath).pipe(res);
});

// Regenerate cover art for a track (and all tracks in the same album)
app.post('/api/cover/:id/regenerate', async (req, res) => {
    try {
        const track = queries.getTrack.get(req.params.id);
        if (!track) return res.status(404).json({ error: 'Track not found' });

        console.log(`Regenerating cover for track ${track.id} ("${track.title}")...`);

        const coverPath = await coverart.generateCover({
            artistName: track.artist,
            songTitle: track.album || track.title,
            artPrompt: track.art_prompt,
            genre: track.genre,
            lyrics: track.lyrics || '',
        });

        // Apply new cover to this track, plus any sibling tracks that share the same cover_path
        // (i.e. actual album siblings, not unrelated tracks with the same album name)
        const oldCoverPath = track.cover_path;
        queries.updateTrackCover.run({ id: track.id, cover_path: coverPath });

        if (oldCoverPath && track.album) {
            const siblings = db.prepare(
                `SELECT id FROM tracks WHERE album = ? AND artist = ? AND cover_path = ? AND id != ? AND status = 'ready'`
            ).all(track.album, track.artist, oldCoverPath, track.id);
            for (const t of siblings) {
                queries.updateTrackCover.run({ id: t.id, cover_path: coverPath });
            }
            console.log(`Cover regenerated for track ${track.id} + ${siblings.length} album sibling(s)`);
        } else {
            console.log(`Cover regenerated for track ${track.id}`);
        }

        res.json({ success: true, cover_path: coverPath });
    } catch (err) {
        console.error('Cover regeneration failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Artist Photos ───────────────────────────────────────────────────

// Serve artist photo, auto-generate if missing (backfill on access)
app.get('/api/artist-photo/:name', async (req, res) => {
    const artistName = decodeURIComponent(req.params.name);
    let record = queries.getArtistPhoto.get(artistName);

    // Backfill: generate if missing
    if (!record || !record.photo_path || !fs.existsSync(path.resolve(record.photo_path))) {
        try {
            // Get genre hint from the artist's tracks
            const tracks = queries.getTracksByArtist.all(artistName);
            const genre = tracks.length > 0 ? (tracks[0].genre || '') : '';

            const photoPath = await coverart.generateArtistPhoto(artistName, genre);
            queries.insertArtistPhoto.run(artistName, photoPath);
            record = { photo_path: photoPath };
            console.log(`Backfilled artist photo for "${artistName}"`);
        } catch (err) {
            console.error(`Artist photo backfill failed for "${artistName}":`, err.message);
            return res.status(404).json({ error: 'Artist photo not available' });
        }
    }

    const photoPath = path.resolve(record.photo_path);
    if (!fs.existsSync(photoPath)) {
        return res.status(404).json({ error: 'Artist photo file not found' });
    }

    const ext = path.extname(photoPath).toLowerCase();
    const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
    res.setHeader('Content-Type', mimeTypes[ext] || 'image/png');
    const etag = `"${Buffer.from(record.photo_path).toString('base64')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');

    if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
    }

    fs.createReadStream(photoPath).pipe(res);
});

// Regenerate artist photo
app.post('/api/artist-photo/:name/regenerate', async (req, res) => {
    const artistName = decodeURIComponent(req.params.name);
    try {
        console.log(`Regenerating artist photo for "${artistName}"...`);
        const tracks = queries.getTracksByArtist.all(artistName);
        const genre = tracks.length > 0 ? (tracks[0].genre || '') : '';

        const photoPath = await coverart.generateArtistPhoto(artistName, genre);
        queries.insertArtistPhoto.run(artistName, photoPath);
        console.log(`Artist photo regenerated for "${artistName}"`);

        res.json({ success: true, photo_path: photoPath });
    } catch (err) {
        console.error(`Artist photo regeneration failed for "${artistName}":`, err);
        res.status(500).json({ error: err.message });
    }
});

// ── Album Planning & Generation ─────────────────────────────────────

app.post('/api/album/plan', async (req, res) => {
    try {
        const { albumName, artistName, description, trackCount, genre } = req.body;

        if (!albumName || !artistName || !description) {
            return res.status(400).json({ error: 'albumName, artistName, and description are required' });
        }

        const tracks = await albumPlanner.planAlbum({
            albumName,
            artistName,
            description,
            trackCount: parseInt(trackCount) || 5,
            genre: genre || '',
        });

        res.json({ tracks });
    } catch (err) {
        console.error('Album plan error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/album/generate', async (req, res) => {
    try {
        const { albumName, artistName, tracks: trackList, tags, art_prompt, instrumental, genre, description } = req.body;

        if (!albumName || !artistName || !trackList || trackList.length === 0) {
            return res.status(400).json({ error: 'albumName, artistName, and tracks are required' });
        }

        const trackIds = [];

        // Insert all track records
        for (let i = 0; i < trackList.length; i++) {
            const track = trackList[i];
            const result = queries.insertTrack.run({
                title: track.title,
                artist: artistName,
                album: albumName,
                genre: genre || '',
                prompt: track.prompt || description || '',
                tags: Array.isArray(tags) ? tags.join(', ') : (tags || ''),
                art_prompt: art_prompt || '',
                instrumental: instrumental ? 1 : 0,
                track_number: i + 1,
                sonauto_task_id: '',
                status: 'pending',
            });
            trackIds.push(Number(result.lastInsertRowid));
        }

        // Generate ONE shared album cover art, then apply to all tracks
        // Use track prompts as thematic context (lyrics don't exist yet)
        const trackPromptsContext = trackList
            .map(t => t.prompt || '')
            .filter(Boolean)
            .join('\n')
            .slice(0, 2000);

        const firstTrackId = trackIds[0];
        generateAlbumCover(trackIds, {
            artist: artistName,
            albumName,
            title: albumName,
            art_prompt,
            genre,
            lyrics: trackPromptsContext,
        });

        // Start music generation for all tracks in parallel
        for (let i = 0; i < trackIds.length; i++) {
            const trackId = trackIds[i];
            const track = trackList[i];
            startGeneration(trackId, {
                title: track.title,
                artist: artistName,
                prompt: track.prompt || description || '',
                tags,
                art_prompt: '', // cover handled separately
                instrumental,
                genre,
                skipCover: true, // don't generate per-track covers
            });
        }

        res.json({ trackIds, status: 'pending', message: `Album generation started (${trackIds.length} tracks)` });
    } catch (err) {
        console.error('Album generate error:', err);
        res.status(500).json({ error: err.message });
    }
});

async function generateAlbumCover(trackIds, params) {
    try {
        const coverPath = await coverart.generateCover({
            artistName: params.artist,
            songTitle: params.albumName,
            artPrompt: params.art_prompt,
            genre: params.genre,
            lyrics: params.lyrics || '',
        });

        // Apply the same cover to all tracks in the album
        for (const id of trackIds) {
            queries.updateTrackCover.run({ id, cover_path: coverPath });
        }
        console.log(`Album cover art ready for ${trackIds.length} tracks`);
    } catch (err) {
        console.error('Album cover art failed:', err);
        const placeholder = coverart.generatePlaceholder(params.artist, params.albumName);
        for (const id of trackIds) {
            queries.updateTrackCover.run({ id, cover_path: placeholder });
        }
    }

    // Auto-generate artist photo if needed
    try {
        const existing = queries.getArtistPhoto.get(params.artist);
        if (!existing) {
            console.log(`Generating artist photo for "${params.artist}"...`);
            const photoPath = await coverart.generateArtistPhoto(params.artist, params.genre);
            queries.insertArtistPhoto.run(params.artist, photoPath);
            console.log(`Artist photo ready for "${params.artist}"`);
        }
    } catch (err) {
        console.error(`Artist photo failed for "${params.artist}":`, err.message);
    }
}

// ── Stats ───────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
    const stats = queries.getStats.get();
    const recent = queries.getRecentTracks.all(8);
    const pending = queries.getPendingTracks.all();
    const top_artists = queries.getTopArtists.all(6);
    const recent_albums = queries.getRecentAlbums.all(6);
    res.json({ ...stats, recent, pending, top_artists, recent_albums });
});

// ── Delete ──────────────────────────────────────────────────────────

app.delete('/api/tracks/:id', (req, res) => {
    const track = queries.getTrack.get(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    // Clean up files
    if (track.file_path && fs.existsSync(track.file_path)) {
        fs.unlinkSync(track.file_path);
    }
    if (track.cover_path && fs.existsSync(track.cover_path)) {
        fs.unlinkSync(track.cover_path);
    }

    // Stop polling if active
    if (pollingIntervals.has(track.id)) {
        clearInterval(pollingIntervals.get(track.id));
        pollingIntervals.delete(track.id);
    }

    queries.deleteTrack.run(track.id);
    res.json({ success: true });
});

// ── Sync Import ─────────────────────────────────────────────────────

const syncUpload = multer({ dest: path.join(MUSIC_DIR, '.tmp') });

// Check if a track already exists on production (for dry-run / pre-check)
app.get('/api/sync/check', (req, res) => {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${SYNC_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });

    const { title, artist, album } = req.query;
    if (!title || !artist) return res.status(400).json({ error: 'title and artist are required' });

    const existing = db.prepare(
        `SELECT id FROM tracks WHERE title = ? AND artist = ? AND album = ? AND status = 'ready' LIMIT 1`
    ).get(title, artist, album || '');

    res.json({ exists: !!existing, id: existing?.id || null });
});

app.post('/api/sync/import', syncUpload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'artist_photo', maxCount: 1 },
]), (req, res) => {
    try {
        // Auth check
        if (!SYNC_SECRET) return res.status(500).json({ error: 'SYNC_SECRET not configured on server' });
        const auth = req.headers.authorization || '';
        if (auth !== `Bearer ${SYNC_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });

        const meta = JSON.parse(req.body.metadata);

        // ── Duplicate check: skip if title+artist+album already exists ──
        const existing = db.prepare(
            `SELECT id FROM tracks WHERE title = ? AND artist = ? AND album = ? AND status = 'ready' LIMIT 1`
        ).get(meta.title || 'Untitled', meta.artist || 'Unknown', meta.album || '');

        if (existing) {
            // Clean up any uploaded temp files
            for (const field of Object.values(req.files || {})) {
                for (const f of field) {
                    try { fs.unlinkSync(f.path); } catch (_) { }
                }
            }
            console.log(`Sync skipped (already exists): "${meta.title}" by ${meta.artist} → id=${existing.id}`);
            return res.json({ success: true, id: existing.id, skipped: true });
        }

        // Save audio file
        let filePath = '';
        if (req.files.audio && req.files.audio[0]) {
            const audioFile = req.files.audio[0];
            const filename = `track_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`;
            filePath = path.join(MUSIC_DIR, filename);
            fs.renameSync(audioFile.path, filePath);
        }

        // Save cover file
        let coverPath = '';
        if (req.files.cover && req.files.cover[0]) {
            const coverFile = req.files.cover[0];
            const ext = path.extname(meta.cover_path || '.png') || '.png';
            const filename = `cover_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
            coverPath = path.join(COVERS_DIR, filename);
            fs.renameSync(coverFile.path, coverPath);
        }

        // Insert track
        const result = queries.insertTrack.run({
            title: meta.title || 'Untitled',
            artist: meta.artist || 'Unknown',
            album: meta.album || '',
            genre: meta.genre || '',
            prompt: meta.prompt || '',
            tags: meta.tags || '',
            art_prompt: meta.art_prompt || '',
            instrumental: meta.instrumental ? 1 : 0,
            track_number: meta.track_number || 0,
            sonauto_task_id: '',
            status: filePath ? 'ready' : 'pending',
        });
        const newId = Number(result.lastInsertRowid);

        // Update file paths and duration
        if (filePath) {
            queries.updateTrackFile.run({ id: newId, file_path: filePath, duration: meta.duration || 0 });
        }
        if (coverPath) {
            queries.updateTrackCover.run({ id: newId, cover_path: coverPath });
        }

        // Update lyrics if present
        if (meta.lyrics) {
            queries.updateTrackLyrics.run({ id: newId, lyrics: meta.lyrics, lyrics_aligned: meta.lyrics_aligned || '' });
        }

        // Save artist photo if provided
        if (req.files.artist_photo && req.files.artist_photo[0] && meta.artist) {
            const photoFile = req.files.artist_photo[0];
            const ext = path.extname(meta.artist_photo_path || '.png') || '.png';
            const filename = `artist_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
            const photoPath = path.join(COVERS_DIR, filename);
            fs.renameSync(photoFile.path, photoPath);
            queries.insertArtistPhoto.run(meta.artist, photoPath);
        }

        console.log(`Sync imported: "${meta.title}" by ${meta.artist} → id=${newId}`);
        res.json({ success: true, id: newId });
    } catch (err) {
        console.error('Sync import error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── SPA Fallback ────────────────────────────────────────────────────

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Resume polling for any in-progress tracks on startup ────────────

function resumePolling() {
    const pending = queries.getPendingTracks.all();
    for (const track of pending) {
        if (track.sonauto_task_id && (track.status === 'generating' || track.status === 'downloading')) {
            console.log(`Resuming polling for track ${track.id} (${track.title})`);
            startPolling(track.id, track.sonauto_task_id);
        }
    }
}

// ── Start ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
    // ── Diagnostic: log DB & volume state on startup ──
    const DB_PATH_RESOLVED = process.env.DB_PATH || './data/dreamify.db';
    const dbExists = fs.existsSync(DB_PATH_RESOLVED);
    const dbSizeMB = dbExists ? (fs.statSync(DB_PATH_RESOLVED).size / 1024 / 1024).toFixed(2) : '0';
    const stats = queries.getStats.get();
    const trackFiles = fs.existsSync(MUSIC_DIR) ? fs.readdirSync(MUSIC_DIR).filter(f => !f.startsWith('.')).length : 0;
    const coverFiles = fs.existsSync(COVERS_DIR) ? fs.readdirSync(COVERS_DIR).filter(f => !f.startsWith('.')).length : 0;

    console.log(`
  ╔══════════════════════════════════════╗
  ║       🎵 spotif.ai is running       ║
  ║   http://localhost:${PORT}              ║
  ╚══════════════════════════════════════╝

  📊 Startup diagnostics:
     DB path:     ${path.resolve(DB_PATH_RESOLVED)}
     DB exists:   ${dbExists}
     DB size:     ${dbSizeMB} MB
     Tracks (DB): ${stats.total_tracks}
     Artists:     ${stats.total_artists}
     Albums:      ${stats.total_albums}
     Audio files: ${trackFiles}
     Cover files: ${coverFiles}
  `);
    resumePolling();
    backfillPlaceholderCovers();
    backfillPlaceholderArtistPhotos();
});

// ── Backfill placeholder covers on startup ──────────────────────────

async function backfillPlaceholderCovers() {
    try {
        // Find all albums and check if their covers are placeholders
        const albums = queries.getAlbums.all();
        const toBackfill = albums.filter(a => {
            if (!a.cover_path) return true;
            return a.cover_path.includes('placeholder_') || !fs.existsSync(path.resolve(a.cover_path));
        });

        if (toBackfill.length === 0) {
            console.log('All album covers look good — no backfill needed.');
            return;
        }

        console.log(`Backfilling ${toBackfill.length} album cover(s) with placeholder SVGs...`);

        for (const album of toBackfill) {
            try {
                console.log(`  → Regenerating cover for album "${album.album}"...`);
                // Gather lyrics from all tracks in this album for cover context
                const albumTracks = queries.getTracksByAlbum.all(album.album, album.artist);
                const albumLyrics = albumTracks
                    .map(t => t.lyrics)
                    .filter(Boolean)
                    .join('\n---\n')
                    .slice(0, 2000);

                const coverPath = await coverart.generateCover({
                    artistName: album.artist,
                    songTitle: album.album,
                    genre: '',
                    lyrics: albumLyrics,
                });

                // Apply to all tracks in this album
                const tracks = queries.getTracksByAlbum.all(album.album, album.artist);
                for (const t of tracks) {
                    queries.updateTrackCover.run({ id: t.id, cover_path: coverPath });
                }
                console.log(`  ✓ Cover ready for "${album.album}" by "${album.artist}" (${tracks.length} tracks)`);

                // Small delay between albums to avoid rate limits
                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.error(`  ✗ Failed to backfill cover for "${album.album}":`, err.message);
            }
        }

        console.log('Cover backfill complete.');
    } catch (err) {
        console.error('Cover backfill error:', err.message);
    }
}

// ── Backfill placeholder artist photos on startup ───────────────────

async function backfillPlaceholderArtistPhotos() {
    try {
        const artists = queries.getArtists.all();
        const toBackfill = artists.filter(a => {
            if (!a.artist_photo) return false; // no photo at all — on-access backfill handles it
            // Only replace existing placeholder SVGs
            return a.artist_photo.includes('artist_placeholder_') || !fs.existsSync(path.resolve(a.artist_photo));
        });

        if (toBackfill.length === 0) {
            console.log('All artist photos look good — no backfill needed.');
            return;
        }

        console.log(`Backfilling ${toBackfill.length} artist photo(s) with AI-generated portraits...`);

        for (const artist of toBackfill) {
            try {
                console.log(`  → Regenerating photo for "${artist.artist}"...`);
                // Get genre hint from the artist's tracks
                const tracks = queries.getTracksByArtist.all(artist.artist);
                const genre = tracks.length > 0 ? (tracks[0].genre || '') : '';

                const photoPath = await coverart.generateArtistPhoto(artist.artist, genre);
                queries.insertArtistPhoto.run(artist.artist, photoPath);
                console.log(`  ✓ Photo ready for "${artist.artist}"`);

                // Small delay between artists to avoid rate limits
                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.error(`  ✗ Failed to backfill photo for "${artist.artist}":`, err.message);
            }
        }

        console.log('Artist photo backfill complete.');
    } catch (err) {
        console.error('Artist photo backfill error:', err.message);
    }
}
