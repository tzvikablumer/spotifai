const fs = require('fs');
const path = require('path');

const SONAUTO_BASE = 'https://api.sonauto.ai';

/**
 * Start a music generation job via Sonauto API (v3)
 * Docs: https://sonauto.ai/developers
 * 
 * Core params: must provide at least one of tags, lyrics, or prompt.
 * For instrumental: set instrumental=true, only tags/prompt (no lyrics).
 * 
 * @param {object} params
 * @param {string} params.prompt - Song description / style
 * @param {string[]} [params.tags] - Style tags (see sonauto.ai/tag-explorer)
 * @param {boolean} [params.instrumental] - Instrumental only
 * @returns {Promise<string>} task_id
 */
async function generateSong({ prompt, tags = [], instrumental = false }) {
    const apiKey = process.env.SONAUTO_API_KEY;
    if (!apiKey) throw new Error('SONAUTO_API_KEY not configured');

    const body = {
        prompt,
        output_format: 'mp3',
        output_bit_rate: 192,
    };

    // Only include tags if non-empty
    if (tags.length > 0) {
        body.tags = tags;
    }

    if (instrumental) {
        body.instrumental = true;
    }

    const res = await fetch(`${SONAUTO_BASE}/v1/generations/v3`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sonauto generation failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    // Response: { task_id: "uuid" }
    return data.task_id;
}

/**
 * Check the status of a generation task.
 * GET /v1/generations/status/{task_id}
 * Returns a PLAIN STRING (e.g. "SUCCESS", "GENERATING", "FAILURE")
 * 
 * @param {string} taskId
 * @returns {Promise<string>} status string (uppercase)
 */
async function checkStatus(taskId) {
    const apiKey = process.env.SONAUTO_API_KEY;
    if (!apiKey) throw new Error('SONAUTO_API_KEY not configured');

    const res = await fetch(`${SONAUTO_BASE}/v1/generations/status/${taskId}`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sonauto status check failed (${res.status}): ${text}`);
    }

    // The status endpoint returns a plain string like "SUCCESS" or "GENERATING"
    const text = await res.text();
    // Strip quotes if the response is a JSON string (e.g. "\"SUCCESS\"")
    return text.replace(/^"|"$/g, '').trim();
}

/**
 * Fetch the full generation result including song_paths.
 * GET /v1/generations/{task_id}
 * Returns full JSON with song_paths array, lyrics, tags, etc.
 * 
 * @param {string} taskId
 * @returns {Promise<object>} Full generation result
 */
async function getGenerationResult(taskId) {
    const apiKey = process.env.SONAUTO_API_KEY;
    if (!apiKey) throw new Error('SONAUTO_API_KEY not configured');

    const res = await fetch(`${SONAUTO_BASE}/v1/generations/${taskId}`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sonauto get result failed (${res.status}): ${text}`);
    }

    return res.json();
}

/**
 * Download an audio file from URL to local filesystem
 * @param {string} url - Remote audio URL
 * @param {string} destPath - Local file path to save to
 * @returns {Promise<void>}
 */
async function downloadAudio(url, destPath) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
}

module.exports = { generateSong, checkStatus, getGenerationResult, downloadAudio };
