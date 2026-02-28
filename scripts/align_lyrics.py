#!/usr/bin/env python3
"""
Forced lyrics alignment using stable-ts (Whisper).
Takes an audio file and lyrics text, outputs word-level timing JSON to stdout.
"""
import argparse
import json
import sys
import os

def main():
    parser = argparse.ArgumentParser(description='Align lyrics to audio')
    parser.add_argument('--audio', required=True, help='Path to audio file')
    parser.add_argument('--lyrics', required=True, help='Lyrics text to align')
    parser.add_argument('--model', default='base', help='Whisper model size (tiny, base, small, medium)')
    args = parser.parse_args()

    if not os.path.exists(args.audio):
        print(json.dumps({"error": f"Audio file not found: {args.audio}"}), file=sys.stderr)
        sys.exit(1)

    # Suppress noisy logs from torch/whisper
    import warnings
    warnings.filterwarnings("ignore")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

    import logging
    logging.getLogger("stable_whisper").setLevel(logging.WARNING)
    logging.getLogger("whisper").setLevel(logging.WARNING)

    import stable_whisper

    # Load model (cached after first download)
    model = stable_whisper.load_model(args.model)

    # Clean lyrics: remove section headers like [Verse 1], [Chorus], etc.
    import re
    cleaned_lyrics = re.sub(r'\[.*?\]', '', args.lyrics).strip()
    # Collapse multiple newlines
    cleaned_lyrics = re.sub(r'\n{2,}', '\n', cleaned_lyrics)
    # Remove empty lines
    cleaned_lyrics = '\n'.join(line for line in cleaned_lyrics.split('\n') if line.strip())

    if not cleaned_lyrics:
        print(json.dumps([]))
        return

    # Run forced alignment
    result = model.align(args.audio, cleaned_lyrics, language='en')

    # Extract word-level timings
    words = []
    for segment in result.segments:
        for word in segment.words:
            words.append({
                "word": word.word.strip(),
                "start": round(word.start, 3),
                "end": round(word.end, 3),
            })

    print(json.dumps(words))


if __name__ == '__main__':
    main()
