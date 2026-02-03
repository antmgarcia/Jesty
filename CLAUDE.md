# Jesty

A Chrome extension that reads your open tabs and delivers short, funny judgments using AI. Features a Headspace-inspired UI with an expressive illustrated character.

## What it does

- Reads all open browser tabs (titles + URLs)
- Sends them to OpenAI GPT-4o-mini
- Returns a short, punchy roast based on tab content
- Character face changes expression based on the roast mood

## Features

- **New Tab Page**: Replaces Chrome's new tab with Google search + auto-roast
- **Popup**: Click extension icon for on-demand roasts
- **Expressive Character**: 7 illustrated faces (smug, suspicious, yikes, eyeroll, disappointed, melting, dead)
- **Copy to Clipboard**: Share your roasts easily

## Project Structure

```
Jesty/
└── 0. Source/
    ├── manifest.json     # Extension config (Manifest V3)
    ├── newtab.html       # New tab page (Google-style + Jesty)
    ├── newtab.css        # New tab styling
    ├── newtab.js         # New tab logic (auto-roast on load)
    ├── popup.html        # Popup UI with SVG characters
    ├── popup.css         # Headspace-inspired styling
    ├── popup.js          # Popup logic
    ├── config.js         # API key (gitignored)
    ├── config.example.js # Template for config
    └── icons/            # Extension icons
```

## Setup

1. Copy `config.example.js` to `config.js`
2. Add your OpenAI API key to `config.js`
3. Load `0. Source/` folder as unpacked extension in Chrome (`chrome://extensions`)

## Key files

- `newtab.js` / `popup.js` - Contains the system prompt and API logic
- `config.js` - Holds the OpenAI API key. Never commit this file.

## Prompt tuning

The AI prompt mixes 4 tones randomly:
- **Sarcastic**: Dry, deadpan humor
- **Funny**: Absurd, unexpected, playful
- **Assertive**: Direct, bossy, no-nonsense
- **Savage**: Brutal but fair

Rules for the prompt:
- Mix 2 unrelated tabs to expose contradictions
- Be specific (name actual sites, searches, topics)
- Always end with a command or action
- Never mention tab counts
- Never start with dashes or quotes
- Max 12 words

## Character Expressions

The AI returns a mood tag with each roast. Moods map to faces:
- `smug` - Raised eyebrow, smirk
- `suspicious` - One eye squinting
- `yikes` - Wide eyes, grimace
- `eyeroll` - Eyes rolled up
- `disappointed` - Furrowed brows, frown
- `melting` - Dizzy spiral eyes
- `dead` - X eyes, soul leaving

## Design

UI follows Headspace aesthetic:
- Warm cream background (#FDF6F0)
- Soft peachy blobs as decorations
- DM Sans font
- Rounded corners throughout
- Coral/orange accent colors
