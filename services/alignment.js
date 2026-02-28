/**
 * Local forced lyrics alignment using stable-ts (Whisper).
 * Spawns a Python script that aligns lyrics text to audio,
 * returning word-level timing data.
 */
const { execFile } = require('child_process');
const path = require('path');

const PYTHON_BIN = path.join(__dirname, '..', '.venv', 'bin', 'python3');
const ALIGN_SCRIPT = path.join(__dirname, '..', 'scripts', 'align_lyrics.py');

/**
 * Align lyrics to an audio file using Whisper forced alignment.
 *
 * @param {string} audioPath - Path to the audio file (mp3, wav, etc.)
 * @param {string} lyricsText - The lyrics text to align
 * @param {string} [model='base'] - Whisper model size
 * @returns {Promise<Array<{word: string, start: number, end: number}>>}
 */
function alignLyrics(audioPath, lyricsText, model = 'base') {
    return new Promise((resolve, reject) => {
        const args = [
            ALIGN_SCRIPT,
            '--audio', audioPath,
            '--lyrics', lyricsText,
            '--model', model,
        ];

        const proc = execFile(PYTHON_BIN, args, {
            maxBuffer: 10 * 1024 * 1024, // 10MB
            timeout: 120_000, // 2 minutes max
        }, (error, stdout, stderr) => {
            if (error) {
                console.error('Alignment stderr:', stderr);
                return reject(new Error(`Alignment failed: ${error.message}`));
            }

            try {
                const words = JSON.parse(stdout.trim());
                resolve(words);
            } catch (parseErr) {
                console.error('Alignment stdout:', stdout);
                reject(new Error(`Failed to parse alignment output: ${parseErr.message}`));
            }
        });
    });
}

module.exports = { alignLyrics };
