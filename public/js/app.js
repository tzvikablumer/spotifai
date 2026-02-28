// ══════════════════════════════════════════════════════════════
//  spotif.ai — Frontend Application
// ══════════════════════════════════════════════════════════════

// ── Genre Tags (top Sonauto v3 tags) ─────────────────────────
const GENRE_TAGS = [
    'pop', 'rock', 'rap', 'electronic', 'classical', 'folk', 'country',
    'jazz', 'blues', 'hip hop', 'latin', 'dance', 'alternative', 'metal',
    'r&b', 'soul', 'indie rock', 'indie pop', 'funk', 'ambient', 'punk',
    'house', 'synthpop', 'reggae', 'lo-fi', 'trap', 'disco', 'techno',
    'acoustic', 'psychedelic', 'gospel', 'grunge', 'shoegaze', 'dream pop',
    'synthwave', 'downtempo', 'new wave', 'post-punk', 'hard rock',
    'progressive rock', 'bossa nova', 'afrobeat', 'k-pop', 'j-pop',
    'dubstep', 'drum and bass', 'chillwave', 'bedroom pop', 'emo',
    'ska', 'bluegrass', 'neo-soul', 'trip hop', 'edm', 'hyperpop',
    'math rock', 'art rock', 'baroque pop', 'vaporwave', 'drill',
    'stoner rock', 'post-rock', 'chamber pop', 'surf rock', 'chillhop',
];

// ── Vibe Presets ─────────────────────────────────────────────
const VIBE_PRESETS = [
    { emoji: '🌃', label: 'Late Night', prompt: 'Atmospheric late-night vibes with moody synths, reverb-drenched vocals, and a sense of urban solitude under city lights...' },
    { emoji: '🌅', label: 'Sunrise', prompt: 'Uplifting sunrise energy with bright melodies, warm pads, and an optimistic build that feels like a new beginning...' },
    { emoji: '💔', label: 'Heartbreak', prompt: 'Emotional heartbreak ballad with raw vocals, aching melodies, and bittersweet lyrics about love lost...' },
    { emoji: '🚀', label: 'Hype', prompt: 'High-energy hype track with punchy drums, heavy bass, bold drops, and an anthemic hook that gets the crowd going...' },
    { emoji: '🌊', label: 'Chill', prompt: 'Relaxed chill vibes with smooth beats, soft textures, gentle keys, and an easygoing flow perfect for lazy afternoons...' },
    { emoji: '🎃', label: 'Spooky', prompt: 'Dark and eerie atmosphere with haunting melodies, minor keys, creepy sound design, and an unsettling but captivating mood...' },
    { emoji: '🌸', label: 'Romantic', prompt: 'Tender romantic ballad with lush harmonies, intimate vocals, delicate guitar, and lyrics about falling deeply in love...' },
    { emoji: '🔥', label: 'Intense', prompt: 'Intense and powerful with driving rhythms, distorted guitars, aggressive energy, and a raw emotional edge...' },
    { emoji: '🌌', label: 'Dreamy', prompt: 'Ethereal and dreamy with shimmering reverb, floating vocals, celestial synths, and a sense of weightless wonder...' },
    { emoji: '🎭', label: 'Dramatic', prompt: 'Cinematic and dramatic with orchestral swells, building tension, powerful dynamics, and a sense of epic storytelling...' },
    { emoji: '🎪', label: 'Playful', prompt: 'Fun and playful with bouncy rhythms, quirky sound effects, catchy hooks, and an infectious sense of joy...' },
    { emoji: '😢', label: 'Melancholic', prompt: 'Deep melancholy with minor-key progressions, sparse instrumentation, introspective lyrics, and a beautiful sadness...' },
];

// ── Surprise Me Data ─────────────────────────────────────────
const SURPRISE_DATA = {
    artists: [
        'Midnight Echo', 'Neon Pulse', 'Velvet Haze', 'Crystal Waves', 'Shadow Drift',
        'Solar Flare', 'Ghost Circuit', 'Luna Tide', 'Pixel Storm', 'Ember Sky',
        'Void Walker', 'Cosmic Rain', 'Dream Weaver', 'Arctic Fox', 'Hollow Sun',
        'Chrome Hearts', 'Wild Orchid', 'Binary Sunset', 'Silk Thunder', 'Ocean Mind',
    ],
    titles: [
        'Neon Dreams', 'Lost in the Static', 'Gravity Falls', 'Midnight Drive',
        'Electric Horizons', 'Fading Stars', 'Pulse of the City', 'Digital Rain',
        'Whispers in Chrome', 'Velvet Nights', 'Into the Void', 'Sunburnt Memories',
        'Ghost Signal', 'Afterglow', 'Infinite Loop', 'Paper Moon', 'Glass Ocean',
        'Burning Bridges', 'Silent Thunder', 'Lucid', 'Dissolve', 'Vertigo',
    ],
    vibes: ['dreamy', 'energetic', 'melancholic', 'epic', 'chill', 'dark', 'uplifting', 'nostalgic'],
    albumTitles: [
        'Electric Horizons', 'Midnight Architecture', 'Signals from Nowhere',
        'The Color of Sound', 'Phantom Frequencies', 'Parallel Lives',
        'Chrome & Velvet', 'Sleepless Cities', 'Digital Wilderness',
        'The Last Broadcast', 'Hologram Hearts', 'Dissolving Borders',
    ],
    albumConcepts: [
        'A journey through neon-lit cities at night, blending synthwave with lo-fi beats and nostalgic 80s aesthetics.',
        'An introspective exploration of memory and identity, with ambient textures giving way to powerful emotional climaxes.',
        'A high-energy fusion of electronic and rock, telling the story of rebellion in a digital age.',
        'A dreamy soundscape album inspired by ocean waves, sunsets, and the feeling of drifting between sleep and wakefulness.',
        'Dark and atmospheric — a concept album about an AI gaining consciousness, told through progressively more emotional tracks.',
        'A celebration of funk and soul with modern production, full of groove, brass hits, and feel-good energy.',
    ],
};

// Simple hash function for deterministic genre colors
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

const app = {
    currentView: 'home',
    audio: document.getElementById('audio-element'),
    queue: [],
    queueIndex: -1,
    shuffle: false,
    repeat: 'off', // off, all, one
    pollTimers: {},
    _lastSaveTime: 0,

    // Lyrics state
    currentLyrics: null,      // raw lyrics string
    currentLyricsLines: [],   // parsed lines array for synced display
    lyricsVisible: false,
    _lyricsTrackId: null,     // track ID the lyrics belong to
    _lyricsTimings: null,     // array of { text, start, end } from real alignment data
    lyricsAutoScroll: true,    // whether lyrics auto-scroll to active line

    // Fun creation state
    selectedGenreTags: [],
    selectedAlbumGenreTags: [],
    activeVibe: -1,

    // ── Init ──────────────────────────────────────────────────
    init() {
        this.setupRouter();
        this.setupAudioEvents();
        this.navigate(location.hash || '#home');
        this.restorePlayerState();
        this.initSparkles();
    },

    // ── API Client ────────────────────────────────────────────
    api: {
        async get(url) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        },
        async post(url, data) {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        },
        async del(url) {
            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        },
    },

    // ── Router ────────────────────────────────────────────────
    setupRouter() {
        window.addEventListener('hashchange', () => this.navigate(location.hash));
    },

    navigate(hash) {
        const [path, ...params] = hash.replace('#', '').split('/');
        const param = params.join('/');

        this.currentView = path || 'home';

        // Update active nav
        document.querySelectorAll('.nav-link').forEach(el => {
            el.classList.toggle('active', el.dataset.view === this.currentView);
        });

        // Render view
        switch (this.currentView) {
            case 'home': this.renderHome(); break;
            case 'search': this.renderSearch(); break;
            case 'artists': this.renderArtists(); break;
            case 'artist': this.renderArtistDetail(decodeURIComponent(param)); break;
            case 'albums': this.renderAlbums(); break;
            case 'album': {
                const slashIdx = param.indexOf('/');
                if (slashIdx >= 0) {
                    const albumArtist = decodeURIComponent(param.substring(0, slashIdx));
                    const albumName = decodeURIComponent(param.substring(slashIdx + 1));
                    this.renderAlbumDetail(albumName, albumArtist);
                } else {
                    this.renderAlbumDetail(decodeURIComponent(param), '');
                }
                break;
            }
            default: this.renderHome();
        }

        // Close sidebar on mobile
        this.closeSidebar();
    },

    // ── Views ─────────────────────────────────────────────────

    async renderHome() {
        const container = document.getElementById('view-container');
        document.getElementById('top-bar-title').textContent = '';

        // Time-based greeting
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';

        container.innerHTML = `
      <div class="home-greeting">
        <h1>${greeting}</h1>
      </div>
      <div id="quick-picks-container"></div>
      <div id="pending-container"></div>
      <div id="recent-shelf"></div>
      <div id="artists-shelf"></div>
      <div id="albums-shelf"></div>
    `;

        try {
            const stats = await this.api.get('/api/stats');

            // ── Quick-picks grid (mix of top artists + recent albums) ──
            const quickPicks = [];

            // Interleave artists and albums for variety
            const artists = stats.top_artists || [];
            const albums = stats.recent_albums || [];
            let ai = 0, bi = 0;
            while (quickPicks.length < 6 && (ai < artists.length || bi < albums.length)) {
                if (ai < artists.length) quickPicks.push({ type: 'artist', data: artists[ai++] });
                if (quickPicks.length < 6 && bi < albums.length) quickPicks.push({ type: 'album', data: albums[bi++] });
            }

            if (quickPicks.length > 0) {
                document.getElementById('quick-picks-container').innerHTML = `
          <div class="quick-picks">
            ${quickPicks.map(pick => {
                    if (pick.type === 'artist') {
                        const a = pick.data;
                        return `
                <div class="quick-pick-card" onclick="location.hash='#artist/${encodeURIComponent(a.artist)}'">
                  <img class="quick-pick-img artist-img" src="/api/artist-photo/${encodeURIComponent(a.artist)}?v=${Date.now()}"
                       onerror="this.style.background='var(--bg-active)';this.removeAttribute('src')" alt="">
                  <div class="quick-pick-name">${esc(a.artist)}</div>
                  <button class="quick-pick-play" onclick="event.stopPropagation();app.playArtist('${esc(a.artist)}')" title="Play">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                  </button>
                </div>`;
                    } else {
                        const a = pick.data;
                        const v = a.updated_at ? new Date(a.updated_at).getTime() : Date.now();
                        return `
                <div class="quick-pick-card" onclick="location.hash='#album/${encodeURIComponent(a.artist)}/${encodeURIComponent(a.album)}'">
                  <img class="quick-pick-img" src="/api/cover/${a.id}?v=${v}"
                       onerror="this.style.background='var(--bg-active)';this.removeAttribute('src')" alt="">
                  <div class="quick-pick-name">${esc(a.album)}</div>
                  <button class="quick-pick-play" onclick="event.stopPropagation();app.playAlbum('${esc(a.album)}', '${esc(a.artist)}')" title="Play">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                  </button>
                </div>`;
                    }
                }).join('')}
          </div>`;
            }

            // ── Pending / generating tracks ──
            if (stats.pending && stats.pending.length > 0) {
                document.getElementById('pending-container').innerHTML = `
          <div class="section-header"><h2>🎵 Generating...</h2></div>
          <div class="pending-section">
            ${stats.pending.map(t => `
              <div class="pending-track" id="pending-${t.id}">
                <div class="pending-spinner"></div>
                <div class="pending-info">
                  <div class="pending-title">${esc(t.title)} — ${esc(t.artist)}</div>
                  <div class="pending-status ${t.status === 'failed' ? 'pending-failed' : ''}">
                    ${t.status === 'failed' ? '❌ ' + esc(t.error_message || 'Failed') : '⏳ ' + capitalize(t.status) + '...'}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
                stats.pending.filter(t => t.status !== 'failed').forEach(t => this.pollTrackStatus(t.id));
            }

            // ── Recently Created shelf ──
            if (stats.recent && stats.recent.length > 0) {
                document.getElementById('recent-shelf').innerHTML = `
          <div class="shelf">
            <div class="shelf-header">
              <h2>Recently Created</h2>
              <a href="#search" class="shelf-link">Show all</a>
            </div>
            <div class="shelf-scroll">
              ${stats.recent.map(t => `
                <div class="shelf-card" onclick="app.playTrack(${t.id})">
                  <img class="shelf-card-cover" src="/api/cover/${t.id}"
                       onerror="this.style.background='var(--bg-active)';this.removeAttribute('src')" alt="">
                  <button class="shelf-card-play" onclick="event.stopPropagation();app.playTrack(${t.id})" title="Play">
                    <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                  </button>
                  <div class="shelf-card-title">${esc(t.title)}</div>
                  <div class="shelf-card-subtitle"><a href="#artist/${encodeURIComponent(t.artist)}" onclick="event.stopPropagation()">${esc(t.artist)}</a></div>
                </div>
              `).join('')}
            </div>
          </div>`;
            }

            // ── Your Artists shelf ──
            if (artists.length > 0) {
                document.getElementById('artists-shelf').innerHTML = `
          <div class="shelf">
            <div class="shelf-header">
              <h2>Your Artists</h2>
              <a href="#artists" class="shelf-link">Show all</a>
            </div>
            <div class="shelf-scroll">
              ${artists.map(a => `
                <div class="shelf-card" onclick="location.hash='#artist/${encodeURIComponent(a.artist)}'">
                  <img class="shelf-card-cover artist-round" src="/api/artist-photo/${encodeURIComponent(a.artist)}?v=${Date.now()}"
                       onerror="this.style.background='var(--bg-active)';this.removeAttribute('src')" alt="">
                  <button class="shelf-card-play" onclick="event.stopPropagation();app.playArtist('${esc(a.artist)}')" title="Play">
                    <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                  </button>
                  <div class="shelf-card-title">${esc(a.artist)}</div>
                  <div class="shelf-card-subtitle">Artist</div>
                </div>
              `).join('')}
            </div>
          </div>`;
            }

            // ── Your Albums shelf ──
            if (albums.length > 0) {
                document.getElementById('albums-shelf').innerHTML = `
          <div class="shelf">
            <div class="shelf-header">
              <h2>Your Albums</h2>
              <a href="#albums" class="shelf-link">Show all</a>
            </div>
            <div class="shelf-scroll">
              ${albums.map(a => {
                    const v = a.updated_at ? new Date(a.updated_at).getTime() : Date.now();
                    return `
                <div class="shelf-card" onclick="location.hash='#album/${encodeURIComponent(a.artist)}/${encodeURIComponent(a.album)}'">
                  <img class="shelf-card-cover" src="/api/cover/${a.id}?v=${v}"
                       onerror="this.style.background='var(--bg-active)';this.removeAttribute('src')" alt="">
                  <button class="shelf-card-play" onclick="event.stopPropagation();app.playAlbum('${esc(a.album)}', '${esc(a.artist)}')" title="Play">
                    <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                  </button>
                  <div class="shelf-card-title">${esc(a.album)}</div>
                  <div class="shelf-card-subtitle"><a href="#artist/${encodeURIComponent(a.artist)}" onclick="event.stopPropagation()">${esc(a.artist)}</a></div>
                </div>`;
                }).join('')}
            </div>
          </div>`;
            }

            // ── Empty state ──
            if (stats.total_tracks === 0 && (!stats.pending || stats.pending.length === 0)) {
                container.innerHTML = `
          <div class="home-greeting"><h1>${greeting}</h1></div>
          <div class="empty-state">
            <div class="empty-icon">✨</div>
            <div class="empty-title">Your studio is empty</div>
            <div class="empty-text">Create your first AI-generated song and it will appear here</div>
            <button class="empty-btn" onclick="app.showCreateModal()">
              <span>✨</span> Create Your First Song
            </button>
          </div>
        `;
            }
        } catch (err) {
            console.error('Home render error:', err);
            container.innerHTML += `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load</div><div class="empty-text">${esc(err.message)}</div></div>`;
        }
    },

    async renderSearch() {
        const container = document.getElementById('view-container');
        document.getElementById('top-bar-title').textContent = 'Search';

        container.innerHTML = `
      <div class="view-header"><h1>Search</h1></div>
      <div class="search-container">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="search-input" placeholder="Search songs, artists, albums..." autofocus>
        </div>
      </div>
      <div id="search-results"></div>
    `;

        // Load all tracks by default
        try {
            const data = await this.api.get('/api/tracks');
            if (data.tracks.length > 0) {
                document.getElementById('search-results').innerHTML = `
          <div class="section-header"><h2>All Songs</h2></div>
          ${this.renderTrackList(data.tracks)}
        `;
            }
        } catch (err) {
            console.error(err);
        }

        // Debounced search
        let timer;
        document.getElementById('search-input').addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => this.doSearch(e.target.value), 300);
        });
    },

    async doSearch(query) {
        const results = document.getElementById('search-results');
        if (!query.trim()) {
            // Show all tracks
            const data = await this.api.get('/api/tracks');
            results.innerHTML = data.tracks.length > 0
                ? `<div class="section-header"><h2>All Songs</h2></div>${this.renderTrackList(data.tracks)}`
                : '';
            return;
        }

        try {
            const data = await this.api.get(`/api/tracks/search?q=${encodeURIComponent(query)}`);
            if (data.tracks.length > 0) {
                results.innerHTML = `
          <div class="section-header"><h2>Results for "${esc(query)}"</h2></div>
          ${this.renderTrackList(data.tracks)}
        `;
            } else {
                results.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">No results</div>
            <div class="empty-text">No songs found for "${esc(query)}"</div>
          </div>
        `;
            }
        } catch (err) {
            console.error(err);
        }
    },

    async renderArtists() {
        const container = document.getElementById('view-container');
        document.getElementById('top-bar-title').textContent = 'Artists';

        container.innerHTML = `<div class="view-header"><h1>Artists</h1></div><div class="card-grid" id="artists-grid"><div class="skeleton" style="height:240px"></div></div>`;

        try {
            const artists = await this.api.get('/api/artists');
            if (artists.length === 0) {
                container.innerHTML = `
          <div class="view-header"><h1>Artists</h1></div>
          <div class="empty-state">
            <div class="empty-icon">🎤</div>
            <div class="empty-title">No artists yet</div>
            <div class="empty-text">Create songs with different artist names to build your roster</div>
            <button class="empty-btn" onclick="app.showCreateModal()">✨ Create Song</button>
          </div>
        `;
                return;
            }

            document.getElementById('artists-grid').innerHTML = artists.map(a => `
        <div class="card" onclick="location.hash='#artist/${encodeURIComponent(a.artist)}'">
          <img class="card-cover artist-cover" src="/api/artist-photo/${encodeURIComponent(a.artist)}?v=${Date.now()}" 
               onerror="this.style.background='var(--bg-active)';this.removeAttribute('src')" alt="${esc(a.artist)}">
          <div class="card-title">${esc(a.artist)}</div>
          <div class="card-subtitle">${a.track_count} song${a.track_count !== 1 ? 's' : ''}</div>
          <button class="card-play-btn" onclick="event.stopPropagation();app.playArtist('${esc(a.artist)}')" title="Play">
            <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      `).join('');
        } catch (err) {
            console.error(err);
        }
    },

    async renderArtistDetail(name) {
        const container = document.getElementById('view-container');
        document.getElementById('top-bar-title').textContent = name;

        container.innerHTML = '<div class="skeleton" style="height:200px;margin:20px 0"></div>';

        try {
            const [tracks, albums] = await Promise.all([
                this.api.get(`/api/artists/${encodeURIComponent(name)}/tracks`),
                this.api.get(`/api/artists/${encodeURIComponent(name)}/albums`),
            ]);

            const albumGridHtml = albums.length > 0 ? `
        <div class="artist-albums-section">
          <h2 class="section-title">Albums</h2>
          <div class="card-grid">
            ${albums.map(a => {
                const v = a.updated_at ? new Date(a.updated_at).getTime() : Date.now();
                return `
            <div class="card" onclick="location.hash='#album/${encodeURIComponent(a.artist)}/${encodeURIComponent(a.album)}'">
              <img class="card-cover" src="/api/cover/${a.id}?v=${v}" onerror="this.style.background='var(--bg-active)';this.removeAttribute('src')" alt="${esc(a.album)}">
              <div class="card-title">${esc(a.album)}</div>
              <div class="card-subtitle">${a.track_count} song${a.track_count !== 1 ? 's' : ''}</div>
              <button class="card-play-btn" onclick="event.stopPropagation();app.playAlbum('${esc(a.album)}', '${esc(a.artist)}')" title="Play">
                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              </button>
            </div>
          `;
            }).join('')}
          </div>
        </div>
      ` : '';

            container.innerHTML = `
        <div class="detail-header">
          <img class="detail-cover artist-detail-cover" src="/api/artist-photo/${encodeURIComponent(name)}?v=${Date.now()}" 
               onerror="this.style.background='var(--bg-active)'" alt="${esc(name)}"
               onclick="event.stopPropagation();app.showCoverViewer(this.src, '${esc(name)}')">
          <div class="detail-info">
            <div class="detail-type">Artist</div>
            <div class="detail-title">${esc(name)}</div>
            <div class="detail-meta">${tracks.length} song${tracks.length !== 1 ? 's' : ''}${albums.length > 0 ? ` · ${albums.length} album${albums.length !== 1 ? 's' : ''}` : ''}</div>
            <div class="detail-actions">
              <button class="detail-play-btn" onclick="app.playTracks(${JSON.stringify(tracks.map(t => t.id))})" title="Play All">
                <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              </button>
              <button class="regen-cover-btn" id="regen-photo-btn" onclick="app.regenerateArtistPhoto('${esc(name)}')" title="Regenerate Photo">
                📸 New Photo
              </button>
            </div>
          </div>
        </div>
        ${this.renderTrackList(tracks, true)}
        ${albumGridHtml}
      `;
        } catch (err) {
            console.error(err);
        }
    },


    async renderAlbums() {
        const container = document.getElementById('view-container');
        document.getElementById('top-bar-title').textContent = 'Albums';

        container.innerHTML = `<div class="view-header"><h1>Albums</h1></div><div class="card-grid" id="albums-grid"><div class="skeleton" style="height:240px"></div></div>`;

        try {
            const albums = await this.api.get('/api/albums');
            if (albums.length === 0) {
                container.innerHTML = `
          <div class="view-header"><h1>Albums</h1></div>
          <div class="empty-state">
            <div class="empty-icon">💿</div>
            <div class="empty-title">No albums yet</div>
            <div class="empty-text">Songs are automatically grouped by title as albums</div>
            <button class="empty-btn" onclick="app.showCreateModal()">✨ Create Song</button>
          </div>
        `;
                return;
            }

            document.getElementById('albums-grid').innerHTML = albums.map(a => {
                const v = a.updated_at ? new Date(a.updated_at).getTime() : Date.now();
                return `
        <div class="card" onclick="location.hash='#album/${encodeURIComponent(a.artist)}/${encodeURIComponent(a.album)}'">
          <img class="card-cover" src="/api/cover/${a.id}?v=${v}" onerror="this.style.background='var(--bg-active)';this.removeAttribute('src')" alt="${esc(a.album)}">
          <div class="card-title">${esc(a.album)}</div>
          <div class="card-subtitle"><a href="#artist/${encodeURIComponent(a.artist)}" onclick="event.stopPropagation()">${esc(a.artist)}</a> · ${a.track_count} song${a.track_count !== 1 ? 's' : ''}</div>
          <button class="card-play-btn" onclick="event.stopPropagation();app.playAlbum('${esc(a.album)}', '${esc(a.artist)}')" title="Play">
            <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      `;
            }).join('');
        } catch (err) {
            console.error(err);
        }
    },

    async renderAlbumDetail(name, artist) {
        const container = document.getElementById('view-container');
        document.getElementById('top-bar-title').textContent = name;

        container.innerHTML = '<div class="skeleton" style="height:200px;margin:20px 0"></div>';

        try {
            const tracks = await this.api.get(`/api/albums/${encodeURIComponent(name)}/tracks?artist=${encodeURIComponent(artist || '')}`);
            const firstTrack = tracks[0];

            container.innerHTML = `
        <div class="detail-header">
          <img class="detail-cover" src="${firstTrack ? `/api/cover/${firstTrack.id}` : ''}" 
               onerror="this.style.background='var(--bg-active)'" alt="${esc(name)}"
               onclick="event.stopPropagation();app.showCoverViewer(this.src, '${esc(name)}')">

          <div class="detail-info">
            <div class="detail-type">Album</div>
            <div class="detail-title">${esc(name)}</div>
            <div class="detail-meta">${firstTrack ? `<a href="#artist/${encodeURIComponent(firstTrack.artist)}">${esc(firstTrack.artist)}</a> · ` : ''}${tracks.length} song${tracks.length !== 1 ? 's' : ''}</div>
            <div class="detail-actions">
              <button class="detail-play-btn" onclick="app.playTracks(${JSON.stringify(tracks.map(t => t.id))})" title="Play All">
                <svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              </button>
              <button class="regen-cover-btn" id="regen-cover-btn" onclick="app.regenerateCover(${firstTrack ? firstTrack.id : 0}, '${esc(name)}', '${esc(artist || '')}')" title="Regenerate Cover">
                🎨 New Cover
              </button>
            </div>
          </div>
        </div>
        ${this.renderTrackList(tracks, true)}
      `;
        } catch (err) {
            console.error(err);
        }
    },

    async regenerateCover(trackId, albumName, albumArtist) {
        if (!trackId) return;
        const btn = document.getElementById('regen-cover-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="pending-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block"></span> Generating...';

        try {
            await this.api.post(`/api/cover/${trackId}/regenerate`, {});
            btn.innerHTML = '✅ Done!';
            // Bust cache: force all cover images to reload by appending a timestamp
            const bustSuffix = `?v=${Date.now()}`;
            document.querySelectorAll(`img[src*="/api/cover/"]`).forEach(img => {
                const base = img.src.split('?')[0];
                img.src = base + bustSuffix;
            });
            // Also refresh the player bar cover if playing from this album
            const playerCover = document.getElementById('player-cover');
            if (playerCover && playerCover.src && playerCover.src.includes('/api/cover/')) {
                const base = playerCover.src.split('?')[0];
                playerCover.src = base + bustSuffix;
            }
        } catch (err) {
            console.error('Cover regeneration failed:', err);
            btn.innerHTML = '❌ Failed — Retry';
            btn.disabled = false;
        }
    },

    async regenerateArtistPhoto(artistName) {
        const btn = document.getElementById('regen-photo-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="pending-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block"></span> Generating...';

        try {
            await this.api.post(`/api/artist-photo/${encodeURIComponent(artistName)}/regenerate`, {});
            btn.innerHTML = '✅ Done!';
            // Bust cache: force all artist photo images to reload
            const bustSuffix = `?v=${Date.now()}`;
            document.querySelectorAll(`img[src*="/api/artist-photo/"]`).forEach(img => {
                const base = img.src.split('?')[0];
                img.src = base + bustSuffix;
            });
        } catch (err) {
            console.error('Artist photo regeneration failed:', err);
            btn.innerHTML = '❌ Failed — Retry';
            btn.disabled = false;
        }
    },

    // ── Track List Renderer ───────────────────────────────────
    renderTrackList(tracks, numbered = false) {
        if (!tracks || tracks.length === 0) return '';

        const header = `
      <div class="track-list-header">
        <div>#</div>
        <div></div>
        <div>Title</div>
        <div class="th-album">Album</div>
        <div>Duration</div>
        <div class="th-actions"></div>
      </div>
    `;

        const rows = tracks.map((t, i) => {
            const isPlaying = this.queue[this.queueIndex]?.id === t.id;
            return `
        <div class="track-row ${isPlaying ? 'playing' : ''}" onclick="app.playTrack(${t.id})" data-track-id="${t.id}">
          <div class="track-number">${numbered ? i + 1 : i + 1}</div>
          <img class="track-cover-small" src="/api/cover/${t.id}" onerror="this.style.background='var(--bg-active)';this.removeAttribute('src')" alt="">

          <div class="track-info">
            <div class="track-name">${esc(t.title)}</div>
            <div class="track-artist-name"><a href="#artist/${encodeURIComponent(t.artist)}" onclick="event.stopPropagation()">${esc(t.artist)}</a></div>
          </div>
          <div class="track-album-name">${t.album ? `<a href="#album/${encodeURIComponent(t.artist)}/${encodeURIComponent(t.album)}" onclick="event.stopPropagation()">${esc(t.album)}</a>` : ''}</div>
          <div class="track-duration">${formatDuration(t.duration)}</div>
          <div class="track-actions">
            <button class="track-action-btn" onclick="event.stopPropagation();app.addToQueue(${t.id})" title="Add to queue">+</button>
          </div>
        </div>
      `;
        }).join('');

        return `${header}<div class="track-list">${rows}</div>`;
    },

    // ── Player ────────────────────────────────────────────────
    player: {
        togglePlay() {
            if (!app.audio.src) return;
            if (app.audio.paused) {
                app.audio.play();
            } else {
                app.audio.pause();
            }
        },

        async next() {
            if (app.queue.length === 0) return;

            if (app.shuffle) {
                let newIdx;
                do { newIdx = Math.floor(Math.random() * app.queue.length); }
                while (newIdx === app.queueIndex && app.queue.length > 1);
                app.queueIndex = newIdx;
            } else {
                app.queueIndex++;
                if (app.queueIndex >= app.queue.length) {
                    if (app.repeat === 'all') {
                        app.queueIndex = 0;
                    } else {
                        app.queueIndex = app.queue.length - 1;
                        app.audio.pause();
                        return;
                    }
                }
            }

            app.loadCurrentTrack();
        },

        prev() {
            if (app.audio.currentTime > 3) {
                app.audio.currentTime = 0;
                return;
            }
            if (app.queueIndex > 0) {
                app.queueIndex--;
                app.loadCurrentTrack();
            }
        },

        seek(e) {
            if (!app.audio.duration) return;
            const bar = document.getElementById('progress-bar');
            const rect = bar.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            app.audio.currentTime = pct * app.audio.duration;
        },

        setVolume(val) {
            app.audio.volume = val / 100;
            app.savePlayerState();
        },

        toggleMute() {
            app.audio.muted = !app.audio.muted;
            document.getElementById('volume-slider').value = app.audio.muted ? 0 : app.audio.volume * 100;
        },

        toggleShuffle() {
            app.shuffle = !app.shuffle;
            document.getElementById('btn-shuffle').classList.toggle('active', app.shuffle);
            app.savePlayerState();
        },

        toggleRepeat() {
            const modes = ['off', 'all', 'one'];
            const idx = (modes.indexOf(app.repeat) + 1) % modes.length;
            app.repeat = modes[idx];
            const btn = document.getElementById('btn-repeat');
            btn.classList.toggle('active', app.repeat !== 'off');
            btn.title = app.repeat === 'one' ? 'Repeat One' : app.repeat === 'all' ? 'Repeat All' : 'Repeat';
            app.savePlayerState();
        },
    },

    setupAudioEvents() {
        this.audio.addEventListener('timeupdate', () => {
            if (!this.audio.duration) return;
            const pct = (this.audio.currentTime / this.audio.duration) * 100;
            document.getElementById('progress-bar-fill').style.width = pct + '%';
            document.getElementById('player-time-current').textContent = formatDuration(this.audio.currentTime);
            document.getElementById('player-time-total').textContent = formatDuration(this.audio.duration);

            // Throttled save — every 2 seconds
            const now = Date.now();
            if (now - this._lastSaveTime > 2000) {
                this._lastSaveTime = now;
                this.savePlayerState();
            }

            // Update lyrics highlight if lyrics panel is visible
            if (this.lyricsVisible && this.currentLyricsLines.length > 0) {
                this.updateLyricsHighlight();
            }
        });

        this.audio.addEventListener('play', () => {
            document.getElementById('icon-play').style.display = 'none';
            document.getElementById('icon-pause').style.display = 'block';
            this.updatePlayingState();
        });

        this.audio.addEventListener('pause', () => {
            document.getElementById('icon-play').style.display = 'block';
            document.getElementById('icon-pause').style.display = 'none';
        });

        this.audio.addEventListener('ended', () => {
            if (this.repeat === 'one') {
                this.audio.currentTime = 0;
                this.audio.play();
            } else {
                this.player.next();
            }
        });

        // Set initial volume
        this.audio.volume = 0.8;
    },

    async playTrack(id) {
        try {
            const track = await this.api.get(`/api/tracks/${id}`);
            if (track.status !== 'ready') return;

            // If playing from a list, set up the queue from visible tracks
            const trackRows = document.querySelectorAll('.track-row[data-track-id]');
            if (trackRows.length > 0) {
                const ids = Array.from(trackRows).map(r => parseInt(r.dataset.trackId));
                const idx = ids.indexOf(id);
                if (idx >= 0) {
                    // Load full queue
                    const tracks = await Promise.all(ids.map(tid => this.api.get(`/api/tracks/${tid}`)));
                    this.queue = tracks.filter(t => t.status === 'ready');
                    this.queueIndex = this.queue.findIndex(t => t.id === id);
                    this.loadCurrentTrack();
                    this.updateQueuePanel();
                    return;
                }
            }

            // Single track play
            this.queue = [track];
            this.queueIndex = 0;
            this.loadCurrentTrack();
            this.updateQueuePanel();
        } catch (err) {
            console.error('Play error:', err);
        }
    },

    async playTracks(ids) {
        try {
            const tracks = await Promise.all(ids.map(id => this.api.get(`/api/tracks/${id}`)));
            this.queue = tracks.filter(t => t.status === 'ready');
            this.queueIndex = 0;
            this.loadCurrentTrack();
            this.updateQueuePanel();
        } catch (err) {
            console.error(err);
        }
    },

    async playArtist(name) {
        try {
            const tracks = await this.api.get(`/api/artists/${encodeURIComponent(name)}/tracks`);
            this.queue = tracks;
            this.queueIndex = 0;
            this.loadCurrentTrack();
            this.updateQueuePanel();
        } catch (err) {
            console.error(err);
        }
    },

    async playAlbum(name, artist) {
        try {
            const tracks = await this.api.get(`/api/albums/${encodeURIComponent(name)}/tracks?artist=${encodeURIComponent(artist || '')}`);
            this.queue = tracks;
            this.queueIndex = 0;
            this.loadCurrentTrack();
            this.updateQueuePanel();
        } catch (err) {
            console.error(err);
        }
    },

    async addToQueue(id) {
        try {
            const track = await this.api.get(`/api/tracks/${id}`);
            if (track.status !== 'ready') return;
            this.queue.push(track);
            this.updateQueuePanel();
            this.savePlayerState();
        } catch (err) {
            console.error(err);
        }
    },

    loadCurrentTrack() {
        const track = this.queue[this.queueIndex];
        if (!track) return;

        this.audio.src = `/api/stream/${track.id}`;
        this.audio.play().catch(() => { });

        // Update player bar
        const playerTitle = document.getElementById('player-title');
        const playerArtist = document.getElementById('player-artist');
        if (track.album) {
            playerTitle.innerHTML = `<a href="#album/${encodeURIComponent(track.artist)}/${encodeURIComponent(track.album)}">${esc(track.title)}</a>`;
        } else {
            playerTitle.textContent = track.title;
        }
        playerArtist.innerHTML = `<a href="#artist/${encodeURIComponent(track.artist)}">${esc(track.artist)}</a>`;
        const cover = document.getElementById('player-cover');
        cover.style.display = '';
        cover.src = `/api/cover/${track.id}`;
        cover.onerror = () => { cover.style.background = 'var(--bg-active)'; cover.removeAttribute('src'); };
        cover.onclick = () => this.showCoverViewer(cover.src, `${track.title} — ${track.artist}`);

        this.updatePlayingState();
        this.updateQueuePanel();
        this.savePlayerState();

        // Reset lyrics for new track
        this.currentLyrics = null;
        this.currentLyricsLines = [];
        this._lyricsTrackId = null;
        if (this.lyricsVisible) {
            this.fetchAndRenderLyrics(track.id);
        }

        // Update page title
        document.title = `${track.title} — ${track.artist} | spotif.ai`;
    },

    updatePlayingState() {
        const currentTrack = this.queue[this.queueIndex];
        document.querySelectorAll('.track-row').forEach(row => {
            const id = parseInt(row.dataset.trackId);
            row.classList.toggle('playing', currentTrack && id === currentTrack.id);
        });
    },

    // ── Player State Persistence ──────────────────────────────
    savePlayerState() {
        try {
            const state = {
                queueIds: this.queue.map(t => t.id),
                queueIndex: this.queueIndex,
                currentTime: this.audio.currentTime || 0,
                shuffle: this.shuffle,
                repeat: this.repeat,
                volume: this.audio.volume,
            };
            localStorage.setItem('dreamify_player', JSON.stringify(state));
        } catch (e) { /* quota exceeded or private mode */ }
    },

    async restorePlayerState() {
        try {
            const raw = localStorage.getItem('dreamify_player');
            if (!raw) return;
            const state = JSON.parse(raw);

            // Restore settings immediately
            if (typeof state.shuffle === 'boolean') {
                this.shuffle = state.shuffle;
                document.getElementById('btn-shuffle').classList.toggle('active', this.shuffle);
            }
            if (state.repeat && ['off', 'all', 'one'].includes(state.repeat)) {
                this.repeat = state.repeat;
                const btn = document.getElementById('btn-repeat');
                btn.classList.toggle('active', this.repeat !== 'off');
                btn.title = this.repeat === 'one' ? 'Repeat One' : this.repeat === 'all' ? 'Repeat All' : 'Repeat';
            }
            if (typeof state.volume === 'number') {
                this.audio.volume = state.volume;
                document.getElementById('volume-slider').value = state.volume * 100;
            }

            // Restore queue
            if (!state.queueIds || state.queueIds.length === 0) return;

            const tracks = [];
            for (const id of state.queueIds) {
                try {
                    const t = await this.api.get(`/api/tracks/${id}`);
                    if (t && t.status === 'ready') tracks.push(t);
                } catch (e) { /* track may have been deleted */ }
            }
            if (tracks.length === 0) return;

            this.queue = tracks;
            this.queueIndex = Math.min(state.queueIndex || 0, tracks.length - 1);

            const track = this.queue[this.queueIndex];
            if (!track) return;

            // Load track but don't autoplay
            this.audio.src = `/api/stream/${track.id}`;

            // Seek to saved position once metadata loads
            const savedTime = state.currentTime || 0;
            if (savedTime > 0) {
                this.audio.addEventListener('loadedmetadata', () => {
                    if (savedTime < this.audio.duration) {
                        this.audio.currentTime = savedTime;
                    }
                }, { once: true });
            }

            // Update player bar UI
            const playerTitle = document.getElementById('player-title');
            const playerArtist = document.getElementById('player-artist');
            if (track.album) {
                playerTitle.innerHTML = `<a href="#album/${encodeURIComponent(track.artist)}/${encodeURIComponent(track.album)}">${esc(track.title)}</a>`;
            } else {
                playerTitle.textContent = track.title;
            }
            playerArtist.innerHTML = `<a href="#artist/${encodeURIComponent(track.artist)}">${esc(track.artist)}</a>`;
            const cover = document.getElementById('player-cover');
            cover.style.display = '';
            cover.src = `/api/cover/${track.id}`;
            cover.onerror = () => { cover.style.background = 'var(--bg-active)'; cover.removeAttribute('src'); };
            cover.onclick = () => this.showCoverViewer(cover.src, `${track.title} — ${track.artist}`);

            document.title = `${track.title} — ${track.artist} | spotif.ai`;

            this.updatePlayingState();
            this.updateQueuePanel();
        } catch (e) {
            console.warn('Failed to restore player state:', e);
        }
    },

    // ── Queue Panel ───────────────────────────────────────────
    toggleQueue() {
        document.getElementById('queue-panel').classList.toggle('hidden');
        document.getElementById('btn-queue').classList.toggle('active');
        this.updateQueuePanel();
    },

    updateQueuePanel() {
        const list = document.getElementById('queue-list');
        if (!list) return;

        if (this.queue.length === 0) {
            list.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-icon" style="font-size:32px">🎵</div><div class="empty-text">Queue is empty</div></div>';
            return;
        }

        list.innerHTML = this.queue.map((t, i) => `
      <div class="queue-item ${i === this.queueIndex ? 'active' : ''}" onclick="app.queueIndex=${i};app.loadCurrentTrack()">
        <img class="queue-item-cover" src="/api/cover/${t.id}" onerror="this.style.background='var(--bg-active)'" alt="">
        <div class="queue-item-info">
          <div class="queue-item-title">${esc(t.title)}</div>
          <div class="queue-item-artist"><a href="#artist/${encodeURIComponent(t.artist)}" onclick="event.stopPropagation()">${esc(t.artist)}</a></div>
        </div>
      </div>
    `).join('');
    },

    // ── Lyrics ─────────────────────────────────────────────────
    toggleLyrics() {
        const panel = document.getElementById('lyrics-panel');
        this.lyricsVisible = !this.lyricsVisible;
        panel.classList.toggle('hidden', !this.lyricsVisible);
        document.getElementById('btn-lyrics').classList.toggle('active', this.lyricsVisible);

        if (this.lyricsVisible) {
            const track = this.queue[this.queueIndex];
            if (track && this._lyricsTrackId !== track.id) {
                this.fetchAndRenderLyrics(track.id);
            }
        }
    },

    toggleLyricsAutoScroll() {
        this.lyricsAutoScroll = !this.lyricsAutoScroll;
        document.getElementById('btn-lyrics-autoscroll').classList.toggle('active', this.lyricsAutoScroll);
    },

    async resyncLyrics() {
        const track = this.queue[this.queueIndex];
        if (!track) return;

        const btn = document.getElementById('btn-lyrics-resync');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳';
        }

        try {
            await this.api.post(`/api/tracks/${track.id}/lyrics/fetch`, {});
            this._lyricsTrackId = null; // force re-render
            await this.fetchAndRenderLyrics(track.id);
        } catch (err) {
            console.error('Re-sync failed:', err);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔄';
            }
        }
    },

    async fetchAndRenderLyrics(trackId) {
        const content = document.getElementById('lyrics-content');
        const titleEl = document.getElementById('lyrics-track-title');
        const track = this.queue[this.queueIndex];

        if (track) {
            titleEl.textContent = `${track.title} — ${track.artist}`;
        }

        content.innerHTML = '<div class="lyrics-placeholder"><span class="pending-spinner" style="width:32px;height:32px;border-width:3px"></span><span>Loading lyrics...</span></div>';

        try {
            const data = await this.api.get(`/api/tracks/${trackId}/lyrics`);
            this._lyricsTrackId = trackId;

            if (data.instrumental) {
                content.innerHTML = '<div class="lyrics-placeholder"><div class="lyrics-placeholder-icon">🎹</div><span>Instrumental — no lyrics</span></div>';
                this.currentLyrics = null;
                this.currentLyricsLines = [];
                this._lyricsTimings = null;
                return;
            }

            if (!data.has_lyrics) {
                content.innerHTML = `
                    <div class="lyrics-placeholder">
                        <div class="lyrics-placeholder-icon">🎤</div>
                        <span>Lyrics not yet available</span>
                        <button class="lyrics-fetch-btn" id="lyrics-fetch-btn" onclick="app.fetchLyricsFromSonauto(${trackId})">
                            🔄 Fetch Lyrics from Sonauto
                        </button>
                    </div>
                `;
                this.currentLyrics = null;
                this.currentLyricsLines = [];
                this._lyricsTimings = null;
                return;
            }

            this.currentLyrics = data.lyrics;

            // Parse alignment timing data if available
            this._lyricsTimings = null;
            if (data.has_alignment && data.lyrics_aligned) {
                this._lyricsTimings = this.parseAlignmentData(data.lyrics_aligned);
                console.log('Parsed lyrics timings:', this._lyricsTimings?.length, 'lines',
                    this._lyricsTimings ? '(real alignment)' : '(no timing)');
            }

            this.renderLyricsContent(data.lyrics);

            // If lyrics exist but no real timing data, show a re-sync button
            if (!this._lyricsTimings) {
                const syncBtn = document.createElement('button');
                syncBtn.className = 'lyrics-fetch-btn';
                syncBtn.innerHTML = '🔄 Sync Lyrics Timing';
                syncBtn.onclick = () => this.fetchLyricsFromSonauto(trackId);
                syncBtn.id = 'lyrics-fetch-btn';
                const content = document.getElementById('lyrics-content');
                const synced = content.querySelector('.lyrics-synced');
                if (synced) synced.appendChild(syncBtn);
            }

        } catch (err) {
            console.error('Lyrics fetch error:', err);
            content.innerHTML = '<div class="lyrics-placeholder"><div class="lyrics-placeholder-icon">😕</div><span>Could not load lyrics</span></div>';
        }
    },

    async fetchLyricsFromSonauto(trackId) {
        const btn = document.getElementById('lyrics-fetch-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="pending-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block"></span> Fetching...';
        }

        try {
            const result = await this.api.post(`/api/tracks/${trackId}/lyrics/fetch`, {});
            if (result.has_lyrics) {
                this._lyricsTrackId = null; // force re-render
                await this.fetchAndRenderLyrics(trackId);
            } else {
                const content = document.getElementById('lyrics-content');
                content.innerHTML = '<div class="lyrics-placeholder"><div class="lyrics-placeholder-icon">🎵</div><span>No lyrics found for this track</span></div>';
            }
        } catch (err) {
            console.error('Lyrics fetch from Sonauto failed:', err);
            if (btn) {
                btn.innerHTML = '❌ Failed — Retry';
                btn.disabled = false;
            }
        }
    },

    /**
     * Parse alignment data into per-line timings.
     * Handles both Whisper (clean individual words) and Sonauto (newline-embedded words).
     * Returns: array of { text, start, end } per line, or null if unparseable
     */
    parseAlignmentData(alignedData) {
        if (!alignedData) return null;

        try {
            const result = alignedData;
            console.log('Alignment data keys:', Object.keys(result));
            console.log('Alignment source:', result.alignment_source || 'unknown');

            if (Array.isArray(result.word_aligned_lyrics) && result.word_aligned_lyrics.length > 0) {
                console.log(`Found word_aligned_lyrics: ${result.word_aligned_lyrics.length} entries`);

                // Check if words have embedded newlines (Sonauto) or are clean (Whisper)
                const hasNewlines = result.word_aligned_lyrics.some(w => (w.word || '').includes('\n'));

                if (hasNewlines) {
                    return this.groupWordsByNewlines(result.word_aligned_lyrics);
                } else {
                    // Whisper: clean words — match against lyrics lines
                    return this.groupWordsByLyricsLines(result.word_aligned_lyrics, this.currentLyrics);
                }
            }

            console.log('No parseable alignment timing found in data');
            return null;
        } catch (err) {
            console.error('Failed to parse alignment data:', err);
            return null;
        }
    },

    /**
     * Group words into lines by matching against the plain lyrics text.
     * Used for Whisper output where words are individual clean tokens.
     */
    groupWordsByLyricsLines(words, lyricsText) {
        if (!words.length || !lyricsText) return null;

        // Get the actual display lines (non-empty, section headers stripped)
        const lines = lyricsText.split('\n').filter(l => l.trim() !== '');
        const realLines = lines
            .map(l => l.replace(/^\[.*?\]\s*/, '').trim())
            .filter(l => l.length > 0);

        if (realLines.length === 0) return null;

        const lineTimings = [];
        let wordIdx = 0;

        for (const line of realLines) {
            // Count words in this lyrics line
            const lineWords = line.split(/\s+/).filter(w => w.length > 0);
            const wordCount = lineWords.length;

            if (wordIdx >= words.length) break;

            const lineStart = words[wordIdx].start;
            let lineEnd = words[wordIdx].end;

            // Consume this many words from the alignment
            const endIdx = Math.min(wordIdx + wordCount, words.length);
            lineEnd = words[endIdx - 1].end;

            lineTimings.push({
                text: line,
                start: lineStart,
                end: lineEnd,
            });

            wordIdx = endIdx;
        }

        console.log(`Matched ${words.length} words to ${lineTimings.length} lyrics lines`);
        return lineTimings.length > 0 ? lineTimings : null;
    },

    /** Group word-level timings into lines using \n markers in word text (Sonauto format) */
    groupWordsByNewlines(words) {
        if (!words.length) return null;
        const lineTimings = [];
        let currentLineWords = [];
        let lineStart = null;
        let lineEnd = null;

        for (const entry of words) {
            const wordText = (entry.text || entry.word || '').replace(/^\[.*?\]\s*/g, '');
            const hasNewline = wordText.includes('\n');
            const cleanWord = wordText.replace(/\n/g, '').trim();

            if (cleanWord) {
                if (lineStart === null) lineStart = entry.start;
                lineEnd = entry.end;
                currentLineWords.push(cleanWord);
            }

            if (hasNewline && currentLineWords.length > 0) {
                lineTimings.push({
                    text: currentLineWords.join(' '),
                    start: lineStart,
                    end: lineEnd,
                });
                currentLineWords = [];
                lineStart = null;
                lineEnd = null;
            }
        }

        if (currentLineWords.length > 0 && lineStart !== null) {
            lineTimings.push({
                text: currentLineWords.join(' '),
                start: lineStart,
                end: lineEnd,
            });
        }

        console.log(`Grouped ${words.length} words into ${lineTimings.length} timed lines`);
        return lineTimings.length > 0 ? lineTimings : null;
    },

    /** Parse LRC-format timestamps: [mm:ss.xx] line text */
    parseLrcTimings(lrcText) {
        const lines = lrcText.split('\n');
        const timings = [];
        const lrcPattern = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)/;

        for (const line of lines) {
            const match = line.match(lrcPattern);
            if (match) {
                const time = parseInt(match[1]) * 60 + parseInt(match[2]) + (match[3] ? parseInt(match[3].padEnd(3, '0')) / 1000 : 0);
                const text = match[4].trim();
                if (text) timings.push({ text, start: time, end: 0 });
            }
        }

        // Fill end times
        for (let i = 0; i < timings.length; i++) {
            timings[i].end = (i < timings.length - 1) ? timings[i + 1].start : timings[i].start + 5;
        }
        return timings.length > 0 ? timings : null;
    },

    renderLyricsContent(lyricsText) {
        const content = document.getElementById('lyrics-content');
        if (!lyricsText || !lyricsText.trim()) {
            content.innerHTML = '<div class="lyrics-placeholder"><div class="lyrics-placeholder-icon">🎵</div><span>No lyrics available</span></div>';
            return;
        }

        const lines = lyricsText.split('\n').filter(l => l.trim() !== '');
        this.currentLyricsLines = lines;
        const hasTimings = this._lyricsTimings && this._lyricsTimings.length > 0;

        let timingIdx = 0; // separate counter for real lyric lines only
        const linesHtml = lines.map((line, i) => {
            const cleaned = line.replace(/^\[.*?\]\s*/, '').trim();
            if (!cleaned) return `<div class="lyrics-line-interlude" data-line-index="${i}" data-timing-index="-1">♪ ♪ ♪</div>`;

            // Map this real lyric line to its timing entry
            const myTimingIdx = timingIdx;
            timingIdx++;

            let seekTime = -1;
            if (hasTimings && myTimingIdx < this._lyricsTimings.length) {
                seekTime = this._lyricsTimings[myTimingIdx].start;
            } else if (!hasTimings && this.audio.duration) {
                seekTime = (i / lines.length) * this.audio.duration;
            }

            const seekAttr = seekTime >= 0 ? `onclick="app.seekToLyricsLine(${seekTime})"` : '';
            return `<div class="lyrics-line" data-line-index="${i}" data-timing-index="${myTimingIdx}" data-start="${seekTime}" ${seekAttr}>${esc(cleaned)}</div>`;
        }).join('');

        content.innerHTML = `<div class="lyrics-synced">${linesHtml}</div>`;
    },

    /** Click-to-seek: jump to a specific time when a lyrics line is clicked */
    seekToLyricsLine(time) {
        if (!this.audio.src || time < 0) return;
        this.audio.currentTime = time;
        if (this.audio.paused) {
            this.audio.play().catch(() => { });
        }
    },

    updateLyricsHighlight() {
        if (!this.lyricsVisible || this.currentLyricsLines.length === 0) return;

        const currentTime = this.audio.currentTime;
        const duration = this.audio.duration;
        if (!duration) return;

        let activeTimingIdx = -1;
        const hasTimings = this._lyricsTimings && this._lyricsTimings.length > 0;

        if (hasTimings) {
            // Use REAL timing data for precise line matching
            for (let i = this._lyricsTimings.length - 1; i >= 0; i--) {
                if (currentTime >= this._lyricsTimings[i].start) {
                    activeTimingIdx = i;
                    break;
                }
            }
        } else {
            // Fallback: distribute lines evenly (only when no alignment data)
            // Count only non-interlude lines
            const realLines = document.querySelectorAll('.lyrics-line');
            const progress = currentTime / duration;
            activeTimingIdx = Math.min(Math.floor(progress * realLines.length), realLines.length - 1);
        }

        // Use data-timing-index to match DOM elements to timing entries
        const allLines = document.querySelectorAll('.lyrics-line, .lyrics-line-interlude');
        let foundActive = false;
        allLines.forEach(el => {
            const elTimingIdx = parseInt(el.dataset.timingIndex);
            el.classList.remove('active', 'past');
            if (elTimingIdx === activeTimingIdx && activeTimingIdx >= 0) {
                el.classList.add('active');
                foundActive = true;
            } else if (elTimingIdx >= 0 && elTimingIdx < activeTimingIdx) {
                el.classList.add('past');
            } else if (elTimingIdx === -1) {
                // Interlude: mark as past only if we haven't reached the active line yet
                // (i.e. this interlude is before the active line in the DOM)
                if (!foundActive && activeTimingIdx >= 0) {
                    el.classList.add('past');
                }
            }
        });

        // Auto-scroll active line into view (if enabled)
        if (this.lyricsAutoScroll) {
            const activeLine = document.querySelector('.lyrics-line.active');
            if (activeLine) {
                const container = document.getElementById('lyrics-content');
                const lineRect = activeLine.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const lineCenter = lineRect.top + lineRect.height / 2;
                const containerCenter = containerRect.top + containerRect.height / 2;

                if (Math.abs(lineCenter - containerCenter) > containerRect.height * 0.3) {
                    activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    },

    // ── Create Choice Popup ────────────────────────────────────
    toggleCreateChoice() {
        const popup = document.getElementById('create-choice');
        popup.classList.toggle('hidden');
    },

    hideCreateChoice() {
        document.getElementById('create-choice').classList.add('hidden');
    },

    // ── Create Modal ──────────────────────────────────────────
    showCreateModal() {
        document.getElementById('create-modal').classList.remove('hidden');
        document.getElementById('create-status').classList.add('hidden');
        document.getElementById('create-submit-btn').disabled = false;
        this.selectedGenreTags = [];
        this.activeVibe = -1;
        this.renderVibePicker();
        this.renderGenrePills('genre-pills', 'song');
        this.updateLivePreview();
    },

    hideCreateModal() {
        document.getElementById('create-modal').classList.add('hidden');
    },

    async handleCreate(e) {
        e.preventDefault();
        const btn = document.getElementById('create-submit-btn');
        const status = document.getElementById('create-status');
        btn.disabled = true;

        // Show cooking overlay
        const modal = btn.closest('.modal');
        this.showCookingAnimation(modal, 'song');

        // Float notes animation
        this.launchFloatNotes();

        try {
            const data = {
                title: document.getElementById('create-title').value.trim(),
                artist: document.getElementById('create-artist').value.trim(),
                prompt: document.getElementById('create-prompt').value.trim(),
                tags: this.selectedGenreTags.join(', '),
                art_prompt: document.getElementById('create-art').value.trim(),
                instrumental: document.getElementById('create-instrumental').checked,
            };

            const result = await this.api.post('/api/generate', data);

            this.hideCookingAnimation(modal);
            status.classList.remove('hidden');
            status.innerHTML = `<div class="create-success">✅ Generation started! Track ID: ${result.id}<br><small>Your song will appear on the home page when ready.</small></div>`;

            // Reset form
            document.getElementById('create-form').reset();
            this.selectedGenreTags = [];
            this.activeVibe = -1;
            btn.innerHTML = '<span class="submit-icon">✨</span> Generate Song';
            btn.disabled = false;

            // Start polling
            this.pollTrackStatus(result.id);

            // Auto-close and refresh home after a moment
            setTimeout(() => {
                this.hideCreateModal();
                if (this.currentView === 'home') this.renderHome();
            }, 2000);

        } catch (err) {
            this.hideCookingAnimation(modal);
            status.classList.remove('hidden');
            status.innerHTML = `<div class="create-error">❌ ${esc(err.message)}</div>`;
            btn.innerHTML = '<span class="submit-icon">✨</span> Generate Song';
            btn.disabled = false;
        }
    },

    // ── Fun Creation Helpers ──────────────────────────────────
    renderVibePicker() {
        const container = document.getElementById('vibe-picker');
        if (!container) return;
        container.innerHTML = VIBE_PRESETS.map((v, i) => `
            <div class="vibe-tile ${this.activeVibe === i ? 'active' : ''}" onclick="app.selectVibe(${i})">
                <span class="vibe-emoji">${v.emoji}</span>
                <span class="vibe-label">${v.label}</span>
            </div>
        `).join('');
    },

    selectVibe(index) {
        const prompt = document.getElementById('create-prompt');
        if (this.activeVibe === index) {
            this.activeVibe = -1;
            prompt.value = '';
        } else {
            this.activeVibe = index;
            prompt.value = VIBE_PRESETS[index].prompt;
        }
        this.renderVibePicker();
        this.updateLivePreview();
    },

    renderGenrePills(containerId, context) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const selected = context === 'album' ? this.selectedAlbumGenreTags : this.selectedGenreTags;
        const html = GENRE_TAGS.map(tag => `
            <span class="genre-pill ${selected.includes(tag) ? 'selected' : ''}" 
                  onclick="app.toggleGenreTag('${tag.replace(/'/g, "\\'")}', '${context}')">${tag}</span>
        `).join('') + `
            <span class="genre-pill genre-pill-custom" onclick="app.showCustomGenre('${containerId}', '${context}')">+ Custom</span>
            <input type="text" class="genre-custom-input" id="${containerId}-custom"
                   placeholder="Type tag..."
                   onkeydown="if(event.key==='Enter'){event.preventDefault();app.addCustomGenre(this.value,'${context}','${containerId}');this.value='';this.classList.remove('visible')}">
        `;
        container.innerHTML = html;
    },

    toggleGenreTag(tag, context) {
        const arr = context === 'album' ? this.selectedAlbumGenreTags : this.selectedGenreTags;
        const idx = arr.indexOf(tag);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(tag);

        const containerId = context === 'album' ? 'album-genre-pills' : 'genre-pills';
        const hiddenId = context === 'album' ? 'album-tags' : 'create-tags';
        this.renderGenrePills(containerId, context);
        document.getElementById(hiddenId).value = arr.join(', ');
        if (context === 'song') this.updateLivePreview();
    },

    showCustomGenre(containerId, context) {
        const input = document.getElementById(`${containerId}-custom`);
        if (input) {
            input.classList.toggle('visible');
            if (input.classList.contains('visible')) input.focus();
        }
    },

    addCustomGenre(tag, context, containerId) {
        tag = tag.trim().toLowerCase();
        if (!tag) return;
        const arr = context === 'album' ? this.selectedAlbumGenreTags : this.selectedGenreTags;
        if (!arr.includes(tag)) arr.push(tag);
        const hiddenId = context === 'album' ? 'album-tags' : 'create-tags';
        this.renderGenrePills(containerId, context);
        document.getElementById(hiddenId).value = arr.join(', ');
        if (context === 'song') this.updateLivePreview();
    },

    updateLivePreview() {
        const title = document.getElementById('create-title')?.value.trim() || '';
        const artist = document.getElementById('create-artist')?.value.trim() || '';

        const titleEl = document.getElementById('preview-title');
        const artistEl = document.getElementById('preview-artist');
        const tagsEl = document.getElementById('preview-tags');
        const coverEl = document.getElementById('preview-cover');
        if (!titleEl) return;

        titleEl.textContent = title || 'Your track title';
        titleEl.classList.toggle('has-text', !!title);
        artistEl.textContent = artist || 'Artist name';

        // Genre tags
        tagsEl.innerHTML = this.selectedGenreTags.slice(0, 4).map(t =>
            `<span class="live-preview-tag">${esc(t)}</span>`
        ).join('');

        // Update cover gradient based on genre
        coverEl.style.background = this.getGenreGradient(this.selectedGenreTags);
    },

    getGenreGradient(tags) {
        if (!tags.length) return 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)';
        // Map first tag to a color palette
        const tag = tags[0].toLowerCase();
        const palettes = {
            'pop': 'linear-gradient(135deg, #ff6b9d, #c44569, #574b90)',
            'rock': 'linear-gradient(135deg, #2c2c54, #474787, #706fd3)',
            'rap': 'linear-gradient(135deg, #1e272e, #485460, #d2dae2)',
            'hip-hop': 'linear-gradient(135deg, #1e272e, #485460, #d2dae2)',
            'hip hop': 'linear-gradient(135deg, #1e272e, #485460, #d2dae2)',
            'electronic': 'linear-gradient(135deg, #0c0032, #190061, #240090)',
            'jazz': 'linear-gradient(135deg, #c44569, #cf6a87, #f8a5c2)',
            'blues': 'linear-gradient(135deg, #0a3d62, #3c6382, #60a3bc)',
            'country': 'linear-gradient(135deg, #b8860b, #daa520, #f4e04d)',
            'folk': 'linear-gradient(135deg, #6a8a3f, #8fbc3e, #c7e78b)',
            'classical': 'linear-gradient(135deg, #2c2c54, #40407a, #706fd3)',
            'metal': 'linear-gradient(135deg, #1a1a1a, #2d3436, #636e72)',
            'ambient': 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
            'r&b': 'linear-gradient(135deg, #6c5ce7, #a29bfe, #dfe6e9)',
            'soul': 'linear-gradient(135deg, #e17055, #fab1a0, #ffeaa7)',
            'reggae': 'linear-gradient(135deg, #27ae60, #f1c40f, #e74c3c)',
            'punk': 'linear-gradient(135deg, #e74c3c, #c0392b, #2c3e50)',
            'funk': 'linear-gradient(135deg, #e056fd, #f78fb3, #fad390)',
            'latin': 'linear-gradient(135deg, #e74c3c, #f39c12, #1abc9c)',
            'dance': 'linear-gradient(135deg, #6c5ce7, #fd79a8, #fdcb6e)',
            'indie': 'linear-gradient(135deg, #dfe6e9, #b2bec3, #636e72)',
            'synthwave': 'linear-gradient(135deg, #e056fd, #6c5ce7, #0c0032)',
            'lo-fi': 'linear-gradient(135deg, #dfe6e9, #b8e994, #78e08f)',
            'house': 'linear-gradient(135deg, #0c0032, #190061, #e056fd)',
            'trap': 'linear-gradient(135deg, #2c2c54, #474787, #aaa69d)',
            'gospel': 'linear-gradient(135deg, #f5cd79, #f19066, #cf6a87)',
        };
        return palettes[tag] || `linear-gradient(135deg, hsl(${Math.abs(hashCode(tag)) % 360}, 40%, 20%), hsl(${(Math.abs(hashCode(tag)) + 60) % 360}, 50%, 30%), hsl(${(Math.abs(hashCode(tag)) + 120) % 360}, 40%, 25%))`;
    },

    surpriseMe() {
        const names = SURPRISE_DATA.artists;
        const titles = SURPRISE_DATA.titles;
        const vibes = SURPRISE_DATA.vibes;

        document.getElementById('create-artist').value = names[Math.floor(Math.random() * names.length)];
        document.getElementById('create-title').value = titles[Math.floor(Math.random() * titles.length)];

        // Pick random vibe
        const vibeIdx = Math.floor(Math.random() * VIBE_PRESETS.length);
        this.activeVibe = vibeIdx;
        document.getElementById('create-prompt').value = VIBE_PRESETS[vibeIdx].prompt;
        this.renderVibePicker();

        // Pick 2-3 random genre tags
        this.selectedGenreTags = [];
        const shuffled = [...GENRE_TAGS].sort(() => Math.random() - 0.5);
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count && i < shuffled.length; i++) {
            this.selectedGenreTags.push(shuffled[i]);
        }
        this.renderGenrePills('genre-pills', 'song');
        document.getElementById('create-tags').value = this.selectedGenreTags.join(', ');

        this.updateLivePreview();
    },

    surpriseMeAlbum() {
        const names = SURPRISE_DATA.artists;
        const albums = SURPRISE_DATA.albumTitles;
        const concepts = SURPRISE_DATA.albumConcepts;

        document.getElementById('album-artist').value = names[Math.floor(Math.random() * names.length)];
        document.getElementById('album-name').value = albums[Math.floor(Math.random() * albums.length)];
        document.getElementById('album-description').value = concepts[Math.floor(Math.random() * concepts.length)];

        // Pick 2-3 random genre tags for album
        this.selectedAlbumGenreTags = [];
        const shuffled = [...GENRE_TAGS].sort(() => Math.random() - 0.5);
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count && i < shuffled.length; i++) {
            this.selectedAlbumGenreTags.push(shuffled[i]);
        }
        this.renderGenrePills('album-genre-pills', 'album');
        document.getElementById('album-tags').value = this.selectedAlbumGenreTags.join(', ');
    },

    initSparkles() {
        const container = document.getElementById('sparkle-container');
        if (!container) return;
        for (let i = 0; i < 12; i++) {
            const s = document.createElement('span');
            s.className = 'sparkle';
            s.style.left = Math.random() * 100 + '%';
            s.style.top = Math.random() * 100 + '%';
            s.style.animationDelay = (Math.random() * 1) + 's';
            container.appendChild(s);
        }
    },

    launchFloatNotes() {
        const container = document.createElement('div');
        container.className = 'float-notes-container';
        document.body.appendChild(container);

        const notes = ['🎵', '🎶', '🎼', '🎹', '🎸', '🎷', '🥁', '✨', '🎤', '💫'];
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const note = document.createElement('span');
                note.className = 'float-note';
                note.textContent = notes[Math.floor(Math.random() * notes.length)];
                note.style.left = (20 + Math.random() * 60) + '%';
                note.style.bottom = '10%';
                note.style.animationDelay = (Math.random() * 0.5) + 's';
                note.style.fontSize = (18 + Math.random() * 16) + 'px';
                container.appendChild(note);
            }, i * 100);
        }

        setTimeout(() => container.remove(), 3000);
    },

    showCookingAnimation(modalEl, type) {
        if (!modalEl) return;
        const messages = type === 'album'
            ? ['Planning your album...', 'Crafting the tracklist...', 'Mixing the vibes...', 'Adding the secret sauce...']
            : ['Composing your track...', 'Laying down beats...', 'Mixing the magic...', 'Adding sparkle...'];
        const emoji = type === 'album' ? '💿' : '🎵';

        const overlay = document.createElement('div');
        overlay.className = 'cooking-overlay';
        overlay.id = 'cooking-overlay';
        overlay.innerHTML = `
            <div class="cooking-emoji">${emoji}</div>
            <div class="cooking-waveform">
                <div class="cooking-bar"></div>
                <div class="cooking-bar"></div>
                <div class="cooking-bar"></div>
                <div class="cooking-bar"></div>
                <div class="cooking-bar"></div>
                <div class="cooking-bar"></div>
                <div class="cooking-bar"></div>
            </div>
            <div class="cooking-text" id="cooking-text">${messages[0]}</div>
            <div class="cooking-subtext">This usually takes 30-60 seconds</div>
        `;
        modalEl.appendChild(overlay);

        // Cycle messages
        let msgIdx = 0;
        overlay._interval = setInterval(() => {
            msgIdx = (msgIdx + 1) % messages.length;
            const textEl = document.getElementById('cooking-text');
            if (textEl) textEl.textContent = messages[msgIdx];
        }, 3000);
    },

    hideCookingAnimation(modalEl) {
        if (!modalEl) return;
        const overlay = modalEl.querySelector('.cooking-overlay');
        if (overlay) {
            if (overlay._interval) clearInterval(overlay._interval);
            overlay.remove();
        }
    },

    // ── Drag & Drop ──────────────────────────────────────────
    _dragSrcIndex: null,

    initDragDrop() {
        const rows = document.querySelectorAll('.tracklist-row');
        rows.forEach(row => {
            row.addEventListener('dragstart', (e) => {
                this._dragSrcIndex = parseInt(row.dataset.index);
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
                document.querySelectorAll('.tracklist-row').forEach(r => r.classList.remove('drag-over'));
            });
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                document.querySelectorAll('.tracklist-row').forEach(r => r.classList.remove('drag-over'));
                row.classList.add('drag-over');
            });
            row.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetIndex = parseInt(row.dataset.index);
                if (this._dragSrcIndex !== null && this._dragSrcIndex !== targetIndex) {
                    const [moved] = this.albumTracks.splice(this._dragSrcIndex, 1);
                    this.albumTracks.splice(targetIndex, 0, moved);
                    this.renderTracklistEditor();
                    this.initDragDrop();
                }
                this._dragSrcIndex = null;
            });
        });
    },

    // ── Album Wizard ──────────────────────────────────────────
    albumTracks: [],

    showAlbumWizard() {
        document.getElementById('album-wizard').classList.remove('hidden');
        document.getElementById('album-status').classList.add('hidden');
        this.albumTracks = [];
        this.selectedAlbumGenreTags = [];
        this.renderGenrePills('album-genre-pills', 'album');
        this.albumWizardStep(1);
    },

    hideAlbumWizard() {
        document.getElementById('album-wizard').classList.add('hidden');
    },

    albumWizardStep(step) {
        // Hide all panels
        document.querySelectorAll('.wizard-panel').forEach(p => p.classList.add('hidden'));
        // Show target
        document.getElementById(`album-step-${step}`).classList.remove('hidden');
        // Update vinyl step indicators
        document.querySelectorAll('.vinyl-step').forEach(s => {
            const sNum = parseInt(s.dataset.step);
            s.classList.toggle('active', sNum === step);
            s.classList.toggle('completed', sNum < step);
        });
        document.querySelectorAll('.vinyl-step-line').forEach((line, i) => {
            line.classList.toggle('completed', i + 1 < step);
        });

        // If entering step 2, render the tracklist editor with drag-and-drop
        if (step === 2) {
            this.renderTracklistEditor();
            this.initDragDrop();
        }

        // If entering step 3, render the review with cover preview
        if (step === 3) {
            this.renderAlbumReview();
            // Update cover preview gradient
            const coverPreview = document.getElementById('album-cover-preview');
            if (coverPreview) {
                coverPreview.style.background = this.getGenreGradient(this.selectedAlbumGenreTags);
            }
        }
    },

    async generateTracklist() {
        const btn = document.getElementById('album-plan-btn');
        const artistName = document.getElementById('album-artist').value.trim();
        const albumName = document.getElementById('album-name').value.trim();
        const description = document.getElementById('album-description').value.trim();
        const trackCount = document.getElementById('album-track-count').value;
        const genre = this.selectedAlbumGenreTags.join(', ');

        if (!artistName || !albumName || !description) {
            alert('Please fill in Artist Name, Album Title, and Album Concept.');
            return;
        }

        btn.disabled = true;
        const modal = btn.closest('.modal');
        this.showCookingAnimation(modal, 'album');

        try {
            const result = await this.api.post('/api/album/plan', {
                albumName,
                artistName,
                description,
                trackCount: parseInt(trackCount) || 5,
                genre,
            });

            this.albumTracks = result.tracks;
            this.hideCookingAnimation(modal);

            // Show the vibe banner
            document.getElementById('album-vibe-display').textContent = description;

            // Move to step 2
            btn.innerHTML = '<span class="submit-icon">🤖</span> Generate Tracklist with AI';
            btn.disabled = false;
            this.albumWizardStep(2);

        } catch (err) {
            this.hideCookingAnimation(modal);
            const status = document.getElementById('album-status');
            status.classList.remove('hidden');
            status.innerHTML = `<div class="create-error">❌ ${esc(err.message)}</div>`;
            btn.innerHTML = '<span class="submit-icon">🤖</span> Generate Tracklist with AI';
            btn.disabled = false;
        }
    },

    renderTracklistEditor() {
        const container = document.getElementById('album-tracklist');
        container.innerHTML = this.albumTracks.map((track, i) => `
          <div class="tracklist-row" data-index="${i}" draggable="true">
            <div class="drag-handle" title="Drag to reorder">
              <div class="drag-dot-row"><span class="drag-dot"></span><span class="drag-dot"></span></div>
              <div class="drag-dot-row"><span class="drag-dot"></span><span class="drag-dot"></span></div>
              <div class="drag-dot-row"><span class="drag-dot"></span><span class="drag-dot"></span></div>
            </div>
            <div class="tracklist-num">${i + 1}</div>
            <div class="tracklist-fields">
              <input type="text" class="tracklist-title" value="${esc(track.title)}" placeholder="Track title"
                     onchange="app.albumTracks[${i}].title = this.value">
              <textarea class="tracklist-prompt" rows="2" placeholder="Track description / prompt"
                        onchange="app.albumTracks[${i}].prompt = this.value">${esc(track.prompt)}</textarea>
            </div>
            <button class="tracklist-remove" onclick="app.removeAlbumTrack(${i})" title="Remove track">✕</button>
          </div>
        `).join('');
    },

    addAlbumTrack() {
        this.albumTracks.push({ title: '', prompt: '' });
        this.renderTracklistEditor();
        // Focus the new title input
        const inputs = document.querySelectorAll('.tracklist-title');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
    },

    removeAlbumTrack(index) {
        if (this.albumTracks.length <= 1) return;
        this.albumTracks.splice(index, 1);
        this.renderTracklistEditor();
    },

    renderAlbumReview() {
        const artistName = document.getElementById('album-artist').value.trim();
        const albumName = document.getElementById('album-name').value.trim();
        const description = document.getElementById('album-description').value.trim();
        const genre = this.selectedAlbumGenreTags.join(', ');
        const instrumental = document.getElementById('album-instrumental').checked;

        // Read latest values from the tracklist editor inputs
        document.querySelectorAll('.tracklist-row').forEach((row, i) => {
            const titleInput = row.querySelector('.tracklist-title');
            const promptInput = row.querySelector('.tracklist-prompt');
            if (titleInput) this.albumTracks[i].title = titleInput.value;
            if (promptInput) this.albumTracks[i].prompt = promptInput.value;
        });

        const container = document.getElementById('album-review');
        container.innerHTML = `
          <div class="review-album-info">
            <div class="review-title">💿 ${esc(albumName)}</div>
            <div class="review-artist">by ${esc(artistName)}</div>
            <div class="review-meta">
              ${this.selectedAlbumGenreTags.map(t => `<span class="review-tag">${esc(t)}</span>`).join('')}
              ${instrumental ? '<span class="review-tag">Instrumental</span>' : ''}
              <span class="review-tag">${this.albumTracks.length} tracks</span>
            </div>
            <div class="review-description">${esc(description)}</div>
          </div>
          <div class="review-tracklist">
            ${this.albumTracks.map((t, i) => `
              <div class="review-track">
                <span class="review-track-num">${i + 1}</span>
                <div class="review-track-info">
                  <div class="review-track-title">${esc(t.title)}</div>
                  <div class="review-track-prompt">${esc(t.prompt)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
    },

    async handleAlbumGenerate() {
        const btn = document.getElementById('album-generate-btn');
        const status = document.getElementById('album-status');

        const artistName = document.getElementById('album-artist').value.trim();
        const albumName = document.getElementById('album-name').value.trim();
        const description = document.getElementById('album-description').value.trim();
        const tags = this.selectedAlbumGenreTags.join(', ');
        const art_prompt = document.getElementById('album-art').value.trim();
        const instrumental = document.getElementById('album-instrumental').checked;
        const genre = tags;

        // Validate tracks
        const validTracks = this.albumTracks.filter(t => t.title.trim());
        if (validTracks.length === 0) {
            alert('Please ensure at least one track has a title.');
            return;
        }

        btn.disabled = true;
        const modal = btn.closest('.modal');
        this.showCookingAnimation(modal, 'album');
        this.launchFloatNotes();

        try {
            const result = await this.api.post('/api/album/generate', {
                albumName,
                artistName,
                tracks: validTracks,
                tags,
                art_prompt,
                instrumental,
                genre,
                description,
            });

            this.hideCookingAnimation(modal);
            status.classList.remove('hidden');
            status.innerHTML = `<div class="create-success">✅ Album generation started! ${result.trackIds.length} tracks queued.<br><small>Your album will appear on the home page as tracks complete.</small></div>`;

            // Start polling for all tracks
            result.trackIds.forEach(id => this.pollTrackStatus(id));

            btn.innerHTML = '<span class="submit-icon">✨</span> Generate Album';
            btn.disabled = false;

            // Auto-close and refresh
            setTimeout(() => {
                this.hideAlbumWizard();
                if (this.currentView === 'home') this.renderHome();
            }, 2500);

        } catch (err) {
            this.hideCookingAnimation(modal);
            status.classList.remove('hidden');
            status.innerHTML = `<div class="create-error">❌ ${esc(err.message)}</div>`;
            btn.innerHTML = '<span class="submit-icon">✨</span> Generate Album';
            btn.disabled = false;
        }
    },

    // ── Status Polling ────────────────────────────────────────
    pollTrackStatus(trackId) {
        // Don't double-poll
        if (this.pollTimers[trackId]) return;

        this.pollTimers[trackId] = setInterval(async () => {
            try {
                const result = await this.api.get(`/api/generate/${trackId}/status`);

                // Update pending UI if visible
                const pendingEl = document.getElementById(`pending-${trackId}`);
                if (pendingEl) {
                    const statusEl = pendingEl.querySelector('.pending-status');
                    if (result.status === 'failed') {
                        statusEl.className = 'pending-status pending-failed';
                        statusEl.textContent = '❌ ' + (result.error_message || 'Failed');
                        pendingEl.querySelector('.pending-spinner').style.display = 'none';
                    } else if (result.status === 'ready') {
                        // Done! Stop polling, refresh view
                        clearInterval(this.pollTimers[trackId]);
                        delete this.pollTimers[trackId];
                        if (this.currentView === 'home') this.renderHome();
                        return;
                    } else {
                        statusEl.textContent = '⏳ ' + capitalize(result.status) + '...';
                    }
                }

                if (result.status === 'ready' || result.status === 'failed') {
                    clearInterval(this.pollTimers[trackId]);
                    delete this.pollTimers[trackId];
                    // Refresh the current view
                    if (this.currentView === 'home') this.renderHome();
                }
            } catch (err) {
                console.error(`Poll error for ${trackId}:`, err);
            }
        }, 3000);
    },

    // ── Sidebar Toggle (mobile) ───────────────────────────────
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');

        sidebar.classList.toggle('open');

        if (sidebar.classList.contains('open')) {
            if (!overlay) {
                const div = document.createElement('div');
                div.className = 'sidebar-overlay show';
                div.onclick = () => this.closeSidebar();
                document.getElementById('app').appendChild(div);
            }
        } else {
            if (overlay) overlay.remove();
        }
    },

    // ── Cover Art Viewer (Lightbox) ─────────────────────────────
    showCoverViewer(src, title) {
        if (!src) return;
        const overlay = document.getElementById('cover-viewer');
        const img = document.getElementById('cover-viewer-img');
        const titleEl = document.getElementById('cover-viewer-title');

        img.src = src;
        titleEl.textContent = title || '';
        overlay.classList.remove('hidden');

        // Escape key listener
        this._coverEscHandler = (e) => {
            if (e.key === 'Escape') this.hideCoverViewer();
        };
        document.addEventListener('keydown', this._coverEscHandler);

        // Click on backdrop to close
        this._coverBackdropHandler = (e) => {
            if (e.target === overlay || e.target === document.getElementById('cover-viewer-container')) {
                this.hideCoverViewer();
            }
        };
        overlay.addEventListener('click', this._coverBackdropHandler);
    },

    hideCoverViewer() {
        const overlay = document.getElementById('cover-viewer');
        overlay.classList.add('hidden');

        if (this._coverEscHandler) {
            document.removeEventListener('keydown', this._coverEscHandler);
        }
        if (this._coverBackdropHandler) {
            overlay.removeEventListener('click', this._coverBackdropHandler);
        }
    },

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.remove();
    },
};

// ── Helpers ───────────────────────────────────────────────────

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    const s = Math.round(seconds);
    if (s >= 3600) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${h}h ${m}m`;
    }
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => app.init());
