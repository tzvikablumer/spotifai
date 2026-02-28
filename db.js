const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/dreamify.db';

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT DEFAULT '',
    duration REAL DEFAULT 0,
    genre TEXT DEFAULT '',
    prompt TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    art_prompt TEXT DEFAULT '',
    instrumental INTEGER DEFAULT 0,
    track_number INTEGER DEFAULT 0,
    file_path TEXT DEFAULT '',
    cover_path TEXT DEFAULT '',
    sonauto_task_id TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','generating','downloading','ready','failed')),
    error_message TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS generation_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('music','cover')),
    external_id TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
    progress REAL DEFAULT 0,
    error TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Full-text search
  CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
    title, artist, album, genre, prompt,
    content='tracks',
    content_rowid='id'
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
    INSERT INTO tracks_fts(rowid, title, artist, album, genre, prompt)
    VALUES (new.id, new.title, new.artist, new.album, new.genre, new.prompt);
  END;

  CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
    INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, genre, prompt)
    VALUES ('delete', old.id, old.title, old.artist, old.album, old.genre, old.prompt);
  END;

  CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
    INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, genre, prompt)
    VALUES ('delete', old.id, old.title, old.artist, old.album, old.genre, old.prompt);
    INSERT INTO tracks_fts(rowid, title, artist, album, genre, prompt)
    VALUES (new.id, new.title, new.artist, new.album, new.genre, new.prompt);
  END;

  CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
  CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
  CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);

  CREATE TABLE IF NOT EXISTS artist_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist TEXT NOT NULL UNIQUE,
    photo_path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Migrations ──────────────────────────────────────────────────────
try { db.exec('ALTER TABLE tracks ADD COLUMN track_number INTEGER DEFAULT 0'); } catch (e) { /* column already exists */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN lyrics TEXT DEFAULT ''"); } catch (e) { /* column already exists */ }
try { db.exec("ALTER TABLE tracks ADD COLUMN lyrics_aligned TEXT DEFAULT ''"); } catch (e) { /* column already exists */ }

// ── Query helpers ───────────────────────────────────────────────────

const queries = {
  // Tracks
  insertTrack: db.prepare(`
    INSERT INTO tracks (title, artist, album, genre, prompt, tags, art_prompt, instrumental, track_number, sonauto_task_id, status)
    VALUES (@title, @artist, @album, @genre, @prompt, @tags, @art_prompt, @instrumental, @track_number, @sonauto_task_id, @status)
  `),

  getTrack: db.prepare('SELECT * FROM tracks WHERE id = ?'),

  getAllTracks: db.prepare(`
    SELECT * FROM tracks WHERE status = 'ready' ORDER BY created_at DESC
  `),

  getTracksPaginated: db.prepare(`
    SELECT * FROM tracks WHERE status = 'ready' ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),

  getTrackCount: db.prepare(`SELECT COUNT(*) as count FROM tracks WHERE status = 'ready'`),

  getTracksByArtist: db.prepare(`
    SELECT * FROM tracks WHERE artist = ? AND status = 'ready' ORDER BY album, title
  `),

  getTracksByAlbum: db.prepare(`
    SELECT * FROM tracks WHERE album = ? AND artist = ? AND status = 'ready' ORDER BY track_number, id
  `),

  getArtists: db.prepare(`
    SELECT t.artist, COUNT(*) as track_count, 
           MIN(t.cover_path) as cover_path,
           ap.photo_path as artist_photo
    FROM tracks t
    LEFT JOIN artist_photos ap ON ap.artist = t.artist
    WHERE t.status = 'ready' AND t.artist != ''
    GROUP BY t.artist ORDER BY t.artist
  `),

  getArtistPhoto: db.prepare('SELECT * FROM artist_photos WHERE artist = ?'),

  insertArtistPhoto: db.prepare(`
    INSERT OR REPLACE INTO artist_photos (artist, photo_path) VALUES (?, ?)
  `),

  getAlbums: db.prepare(`
    SELECT album, artist, COUNT(*) as track_count,
           MIN(cover_path) as cover_path, MIN(id) as id
    FROM tracks WHERE status = 'ready' AND album != ''
    GROUP BY album, artist ORDER BY album
  `),

  searchTracks: db.prepare(`
    SELECT tracks.* FROM tracks_fts 
    JOIN tracks ON tracks_fts.rowid = tracks.id
    WHERE tracks_fts MATCH ? AND tracks.status = 'ready'
    ORDER BY rank LIMIT 50
  `),

  updateTrackStatus: db.prepare(`
    UPDATE tracks SET status = @status, error_message = @error_message, updated_at = datetime('now')
    WHERE id = @id
  `),

  updateTrackFile: db.prepare(`
    UPDATE tracks SET file_path = @file_path, duration = @duration, status = 'ready', updated_at = datetime('now')
    WHERE id = @id
  `),

  updateTrackCover: db.prepare(`
    UPDATE tracks SET cover_path = @cover_path, updated_at = datetime('now')
    WHERE id = @id
  `),

  deleteTrack: db.prepare('DELETE FROM tracks WHERE id = ?'),

  getStats: db.prepare(`
    SELECT 
      COUNT(*) as total_tracks,
      COUNT(DISTINCT artist) as total_artists,
      COUNT(DISTINCT album) as total_albums,
      COALESCE(SUM(duration), 0) as total_duration
    FROM tracks WHERE status = 'ready'
  `),

  getPendingTracks: db.prepare(`
    SELECT * FROM tracks WHERE status IN ('pending', 'generating', 'downloading') ORDER BY created_at ASC
  `),

  updateTrackLyrics: db.prepare(`
    UPDATE tracks SET lyrics = @lyrics, lyrics_aligned = @lyrics_aligned, updated_at = datetime('now')
    WHERE id = @id
  `),

  getRecentTracks: db.prepare(`
    SELECT * FROM tracks WHERE status = 'ready' ORDER BY created_at DESC LIMIT ?
  `),

  getTopArtists: db.prepare(`
    SELECT t.artist, COUNT(*) as track_count,
           ap.photo_path as artist_photo
    FROM tracks t
    LEFT JOIN artist_photos ap ON ap.artist = t.artist
    WHERE t.status = 'ready' AND t.artist != ''
    GROUP BY t.artist ORDER BY track_count DESC LIMIT ?
  `),

  getRecentAlbums: db.prepare(`
    SELECT album, artist, COUNT(*) as track_count,
           MIN(cover_path) as cover_path, MIN(id) as id,
           MAX(updated_at) as updated_at
    FROM tracks WHERE status = 'ready' AND album != ''
    GROUP BY album, artist ORDER BY MAX(updated_at) DESC LIMIT ?
  `),

  // Generation jobs
  insertJob: db.prepare(`
    INSERT INTO generation_jobs (track_id, type, external_id, status)
    VALUES (@track_id, @type, @external_id, @status)
  `),

  updateJob: db.prepare(`
    UPDATE generation_jobs SET status = @status, progress = @progress, error = @error, updated_at = datetime('now')
    WHERE id = @id
  `),

  getJobsByTrack: db.prepare('SELECT * FROM generation_jobs WHERE track_id = ?'),
};

module.exports = { db, queries };
