const { GoogleGenAI } = require('@google/genai');

/**
 * Use Gemini to generate an album tracklist from a concept description.
 * Returns an array of { title, prompt } objects.
 *
 * @param {object} params
 * @param {string} params.albumName
 * @param {string} params.artistName
 * @param {string} params.description - Album vibe / concept description
 * @param {number} params.trackCount - Number of tracks to generate (default 5)
 * @param {string} [params.genre] - Genre hint
 * @returns {Promise<Array<{title: string, prompt: string}>>}
 */
async function planAlbum({ albumName, artistName, description, trackCount = 5, genre }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a creative music producer and songwriter. 
You help plan album tracklists by generating song titles and detailed musical descriptions.
You MUST respond with ONLY a valid JSON array — no markdown, no code fences, no explanation.
Each element must have exactly two keys: "title" (string) and "prompt" (string).
The prompt should be a rich, detailed description of the song's mood, style, instruments, tempo, and lyrical themes — suitable for an AI music generator.`;

    const userPrompt = `Create a ${trackCount}-song tracklist for an album called "${albumName}" by the artist "${artistName}".

Album concept/vibe: ${description}
${genre ? `Genre: ${genre}` : ''}

Return a JSON array of ${trackCount} tracks. Each track needs:
- "title": a creative, fitting song title
- "prompt": a detailed 2-3 sentence description of the song's sound, mood, instruments, tempo, and themes. Write it as a music production brief.

The tracks should flow together as a cohesive album — consider pacing, variety, and an arc from opener to closer.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: userPrompt,
        config: {
            systemInstruction: systemPrompt,
            temperature: 0.9,
        },
    });

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the JSON array from the response (strip any markdown fences if present)
    const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();

    let tracks;
    try {
        tracks = JSON.parse(cleaned);
    } catch (err) {
        console.error('Failed to parse album plan response:', text);
        throw new Error('AI returned invalid tracklist format');
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
        throw new Error('AI returned empty tracklist');
    }

    // Validate and sanitize each track
    return tracks.map((t, i) => ({
        title: (t.title || `Track ${i + 1}`).trim(),
        prompt: (t.prompt || '').trim(),
    }));
}

module.exports = { planAlbum };
