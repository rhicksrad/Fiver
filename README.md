# Wordle2 (5-letter)

A lightweight, static Wordle-style game that uses 5-letter English words and validates guesses against a locally stored dictionary.

## Setup

1) Generate the 5-letter dictionary (first time only):

- PowerShell (Windows):

```powershell
cd "C:\Users\rhicks.RADINDIANA\Desktop\Wordle2"
./scripts/setup_dictionary.ps1
```

This downloads public word lists and filters/merges them to 5-letter words, saving to `data/allowed_words.json`. A `data/custom_words.txt` file is also created where you can add your own words (one per line) like `farts`.

If you add words later, re-run with `-Force` to rebuild:

```powershell
./scripts/setup_dictionary.ps1 -Force
```

2) Serve the app locally (needed so the browser can fetch the JSON file):

- PowerShell static server (no Python/Node needed):

```powershell
./scripts/serve.ps1 -Port 8000 -Root .
```

Open your browser at `http://localhost:8000`.

- Alternative: Python 3

```powershell
python -m http.server 8000
```

- Alternative: Node.js

```powershell
npx http-server -p 8000 --no-dotfiles --cors
```

Note: Opening `index.html` directly from the file system will not work because the app fetches `data/allowed_words.json` via HTTP.

## Controls

- Type letters on your keyboard or click the on-screen keys.
- Press Enter to submit a guess.
- Press Backspace to delete.
- Toggle "Daily" for a seeded daily word.
- Click "New Game" to pick a new target word.

## Notes

- Guesses must be valid 5-letter words found in `data/allowed_words.json`.
- The target is selected from the same list (random or daily seed).
- No build step is required; this is a static site.

## License

This project uses public word lists, including `dwyl/english-words` and community Wordle lists, to construct its dictionary.
