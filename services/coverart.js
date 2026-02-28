const { fal } = require('@fal-ai/client');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Generate cover art using fal.ai FLUX.1 [dev]
 * @param {object} params
 * @param {string} params.artistName
 * @param {string} params.songTitle
 * @param {string} [params.artPrompt] - User's art description
 * @param {string} [params.genre]
 * @param {string} [params.lyrics] - Song lyrics for thematic context
 * @returns {Promise<string>} Path to saved cover image
 */
async function generateCover({ artistName, songTitle, artPrompt, genre, lyrics }) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
        console.warn('FAL_KEY not configured, generating gradient placeholder');
        return generatePlaceholder(artistName, songTitle);
    }

    const coversDir = process.env.COVERS_DIR || './data/covers';
    fs.mkdirSync(coversDir, { recursive: true });

    // Build base prompts — primary includes artist/title text, fallback is purely visual
    const basePrompts = buildCoverPrompts({ artistName, songTitle, artPrompt, genre, lyrics });

    // Enhance the primary prompt with Gemini's knowledge of the artist's visual style
    const enhancedPrimary = await enhanceCoverPrompt({ artistName, songTitle, artPrompt, genre, lyrics });
    const prompts = enhancedPrimary
        ? [enhancedPrimary, ...basePrompts]
        : basePrompts;

    // Try each prompt in order (enhanced, primary, fallback)
    for (let attempt = 0; attempt < prompts.length; attempt++) {
        const prompt = prompts[attempt];
        try {
            console.log(`Cover art attempt ${attempt + 1}/${prompts.length} for "${songTitle}" by "${artistName}"`);
            const result = await callFluxImage(apiKey, prompt, coversDir);
            if (result) {
                console.log(`Cover art saved (attempt ${attempt + 1}): ${result}`);
                return result;
            }
            console.warn(`Cover art attempt ${attempt + 1}: FLUX returned no image`);
        } catch (err) {
            console.error(`Cover art attempt ${attempt + 1} failed:`, err.message);
        }
    }

    // All attempts failed — fall back to placeholder
    console.warn(`All cover art attempts failed for "${songTitle}", using placeholder`);
    return generatePlaceholder(artistName, songTitle);
}

/**
 * Use Gemini to enhance a cover art prompt with deep knowledge of the artist's visual style.
 * Returns the enhanced prompt string, or null if enhancement is unavailable/fails.
 */
async function enhanceCoverPrompt({ artistName, songTitle, artPrompt, genre, lyrics }) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });

        const systemPrompt = `You are an expert album cover art director and graphic designer with deep knowledge of music history and visual aesthetics.
Your job is to take basic album information and produce a highly specific, vivid image generation prompt that will create a stunning, authentic-looking album cover.

You know:
- The visual identity and iconic album art styles of thousands of artists
- Genre-specific design conventions (e.g. death metal uses dark, intricate illustration; vaporwave uses retro 80s/90s aesthetics; jazz uses minimalist photography)
- Color theory, typography trends, and composition techniques used in professional album covers
- How to reference specific art movements, photography styles, and illustration techniques

You MUST respond with ONLY the enhanced prompt text — no explanations, no markdown, no labels. Just the prompt itself, ready to be sent directly to an image generator.`;

        const lyricsContext = lyrics && lyrics.trim()
            ? `\nSong Lyrics (use these for thematic and mood inspiration — extract key imagery, emotions, and motifs):\n${lyrics.trim().slice(0, 1000)}`
            : '';

        const userPrompt = `Create a detailed image generation prompt for an album cover:

Artist: ${artistName}
Title: ${songTitle}
${genre ? `Genre: ${genre}` : ''}
${artPrompt ? `User's art direction: ${artPrompt}` : ''}${lyricsContext}

Produce a single, detailed prompt (3-5 sentences) that describes the visual style, color palette, composition, artistic techniques, and mood for this album cover. Be very specific about visual details — reference concrete art styles, color palettes, textures, and composition layouts. The style should authentically match what fans of ${artistName} would expect. If lyrics are provided, incorporate their imagery, themes, and emotional tone into the visual concept.

The prompt MUST instruct the image generator to render the artist name "${artistName}" and the title "${songTitle}" as beautiful, integrated typography on the cover — specify the font style, placement, and treatment that fits the aesthetic.

Start directly with the image description. No preamble.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.9,
            },
        });

        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 50) {
            console.log(`Prompt enhanced by Gemini (${text.length} chars)`);
            return text;
        }
        return null;
    } catch (err) {
        console.warn('Gemini prompt enhancement failed, using base prompt:', err.message);
        return null;
    }
}

/**
 * Use Gemini to enhance an artist portrait prompt with knowledge of the artist's appearance and vibe.
 * Returns the enhanced prompt string, or null if unavailable/fails.
 */
async function enhanceArtistPrompt(artistName, genre) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Create a detailed image generation prompt for a professional portrait photograph that depicts the actual musician/band "${artistName}".
${genre ? `Genre: ${genre}.` : ''}

Describe what ${artistName} actually looks like — their real appearance, iconic features, hairstyle, fashion choices, and recognizable visual traits. Then describe the ideal portrait setting: lighting style, pose, wardrobe/styling, background setting, color grading, and overall mood.
Be specific about photography techniques (e.g. "shot on medium format film with shallow depth of field", "studio lighting with dramatic rim light").
If ${artistName} is a band, describe all the band members together in a group portrait.

The image must NOT contain any text or lettering. Portrait suitable for a music streaming platform.

Respond with ONLY the prompt text, no explanations.`,
            config: {
                systemInstruction: 'You are an expert music photographer who knows what every major artist and band looks like. Your job is to describe their ACTUAL appearance so an image generator can create a realistic portrait of them. Respond with only the image generation prompt, no preamble.',
                temperature: 0.8,
            },
        });

        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 50) {
            console.log(`Artist prompt enhanced by Gemini (${text.length} chars)`);
            return text;
        }
        return null;
    } catch (err) {
        console.warn('Gemini artist prompt enhancement failed:', err.message);
        return null;
    }
}

/**
 * Build an array of fallback prompts (used if Gemini enhancement fails).
 */
function buildCoverPrompts({ artistName, songTitle, artPrompt, genre, lyrics }) {
    // Primary prompt: includes artist name, title text, and style references
    let primary = `Create a stunning, professional album cover art image. Square format, 1024x1024.
Artist: "${artistName}"
Title: "${songTitle}"

IMPORTANT: The cover art MUST include the following text rendered with beautiful, professional typography:
- The artist name "${artistName}" on the cover
- The title "${songTitle}" displayed prominently on the cover
Use fonts and text styling that match the genre and mood of the music. The text should be an integral part of the design, not just overlaid — like a real professionally designed album cover.
The overall visual style, color palette, and artistic direction should reflect ${artistName}'s musical identity and aesthetic.`;

    if (artPrompt) {
        primary += `\nSpecific art direction: ${artPrompt}`;
    }
    if (lyrics && lyrics.trim()) {
        // Include a snippet of lyrics for thematic inspiration
        primary += `\nSong lyrics for thematic context (use key imagery and mood): ${lyrics.trim().slice(0, 500)}`;
    }
    if (genre) {
        primary += `\nGenre: ${genre}. The visual style should match this genre and ${artistName}'s style within it.`;
    }
    primary += `\nMake it look like a real, professional album cover. High quality, visually striking.`;

    // Fallback prompt: still references artist style for visual direction, but no text rendering
    let fallback = `Create a beautiful album cover art image. Square format, 1024x1024.
This should be a visually stunning piece of art suitable for a music album cover by ${artistName}.
The visual style should capture the mood and aesthetic associated with ${artistName}'s music.
${genre ? `Genre: ${genre}.` : 'Modern and artistic.'}
${artPrompt ? `Visual direction: ${artPrompt}` : 'Use bold colors, dramatic lighting, and a professional composition.'}
Do NOT include any text, words, or letters in the image. Pure visual art only.`;

    return [primary, fallback];
}

/**
 * Download a file from a URL to a local path.
 * Returns a promise that resolves when complete.
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        proto.get(url, (response) => {
            // Follow redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                file.close();
                fs.unlinkSync(destPath);
                return resolve(downloadFile(response.headers.location, destPath));
            }
            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(destPath);
                return reject(new Error(`Download failed with status ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            reject(err);
        });
    });
}

/**
 * Call fal.ai Nano Banana 2 (Gemini 3.1 Flash Image) and save the result.
 * Returns the file path if successful, or null if no image was returned.
 */
async function callFluxImage(apiKey, prompt, coversDir) {
    // Configure fal with the API key
    fal.config({ credentials: apiKey });

    const result = await fal.subscribe('fal-ai/nano-banana-2', {
        input: {
            prompt,
            aspect_ratio: '1:1',
            num_images: 1,
            safety_tolerance: '6',
            output_format: 'png',
            resolution: '1K',
            enable_web_search: true,
        },
    });

    const images = result?.data?.images || [];
    if (images.length === 0) {
        return null;
    }

    const imageUrl = images[0].url;
    if (!imageUrl) {
        return null;
    }

    // Download the image to local storage
    const filename = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
    const coverPath = path.join(coversDir, filename);
    await downloadFile(imageUrl, coverPath);

    return coverPath;
}

/**
 * Generate a simple SVG gradient placeholder as cover art
 */
function generatePlaceholder(artistName, songTitle) {
    const coversDir = process.env.COVERS_DIR || './data/covers';
    fs.mkdirSync(coversDir, { recursive: true });

    const filename = `placeholder_${Date.now()}.svg`;
    const coverPath = path.join(coversDir, filename);

    // Generate a unique gradient based on the artist/song name
    const hash = simpleHash(artistName + songTitle);
    const hue1 = hash % 360;
    const hue2 = (hue1 + 40 + (hash % 80)) % 360;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue1},70%,30%)"/>
      <stop offset="100%" style="stop-color:hsl(${hue2},80%,20%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="30%" r="60%">
      <stop offset="0%" style="stop-color:rgba(255,255,255,0.15)"/>
      <stop offset="100%" style="stop-color:rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <text x="256" y="230" font-family="system-ui,sans-serif" font-size="28" font-weight="bold" fill="rgba(255,255,255,0.9)" text-anchor="middle">${escapeXml(songTitle.slice(0, 25))}</text>
  <text x="256" y="275" font-family="system-ui,sans-serif" font-size="18" fill="rgba(255,255,255,0.6)" text-anchor="middle">${escapeXml(artistName.slice(0, 30))}</text>
  <circle cx="256" cy="350" r="40" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <polygon points="246,335 246,365 272,350" fill="rgba(255,255,255,0.3)"/>
</svg>`;

    fs.writeFileSync(coverPath, svg);
    return coverPath;
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Generate an artist portrait photo using fal.ai FLUX
 * @param {string} artistName
 * @param {string} [genre] - Optional genre hint
 * @returns {Promise<string>} Path to saved image
 */
async function generateArtistPhoto(artistName, genre) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
        console.warn('FAL_KEY not configured, generating artist placeholder');
        return generateArtistPlaceholder(artistName);
    }

    const coversDir = process.env.COVERS_DIR || './data/covers';
    fs.mkdirSync(coversDir, { recursive: true });

    // Enhance the prompt with Gemini's knowledge of the artist
    const enhancedPrompt = await enhanceArtistPrompt(artistName, genre);
    const prompt = enhancedPrompt || `A professional portrait photograph of ${artistName}, the musician. Square format, 1024x1024.
Show what ${artistName} actually looks like — their real appearance and iconic look.
${genre ? `Genre: ${genre}.` : ''}
The photo should look like a real professional music artist press photo — dramatic lighting, artistic composition.
This should be a portrait suitable for a music streaming platform artist page.
Do NOT include any text, words, or letters in the image. Portrait photography only.`;

    try {
        const result = await callFluxImage(apiKey, prompt, coversDir);
        if (result) {
            console.log(`Artist photo saved: ${result}`);
            return result;
        }

        console.warn('FLUX returned no image for artist photo, generating placeholder');
        return generateArtistPlaceholder(artistName);
    } catch (err) {
        console.error('Artist photo generation failed:', err.message);
        return generateArtistPlaceholder(artistName);
    }
}

/**
 * SVG placeholder with artist initials (circular, gradient background)
 */
function generateArtistPlaceholder(artistName) {
    const coversDir = process.env.COVERS_DIR || './data/covers';
    fs.mkdirSync(coversDir, { recursive: true });

    const filename = `artist_placeholder_${Date.now()}.svg`;
    const photoPath = path.join(coversDir, filename);

    const initials = artistName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const hash = simpleHash(artistName);
    const hue1 = hash % 360;
    const hue2 = (hue1 + 60) % 360;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue1},60%,35%)"/>
      <stop offset="100%" style="stop-color:hsl(${hue2},70%,25%)"/>
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="256" fill="url(#bg)"/>
  <text x="256" y="280" font-family="system-ui,sans-serif" font-size="160" font-weight="bold" fill="rgba(255,255,255,0.85)" text-anchor="middle">${escapeXml(initials)}</text>
</svg>`;

    fs.writeFileSync(photoPath, svg);
    return photoPath;
}

module.exports = { generateCover, generatePlaceholder, generateArtistPhoto, generateArtistPlaceholder };
