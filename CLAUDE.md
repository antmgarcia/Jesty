# Jesty

A Chrome extension that reads your open tabs and delivers short, witty roasts using AI. Features a hero character with expressive moods and a personalized experience that learns your browsing habits.

## What it does

- Reads open browser tabs (titles + URLs with context parsing)
- Sends to OpenAI GPT-4o-mini with personalized context
- Returns a short, punchy roast (max 12 words, 2 lines)
- Character expression changes based on roast mood
- Tracks patterns to deliver smarter, more varied roasts over time

## Features

- **New Tab Page**: Hero Jesty layout with Google search bar, auto-roast on load
- **Side Panel**: Talk back to Jesty, argue with roasts, get sassy advice
- **Popup**: "Feed Jesty" support page with stats
- **Share**: Generate branded images for social sharing
- **Milestones**: Special celebration messages at 25, 60, 100, 500, 1000 roasts
- **Personalization**: Learns your habits, avoids repeating topics, references patterns

## Project Structure

```
Jesty/
├── 0. Source/
│   ├── manifest.json      # Extension config (Manifest V3)
│   ├── newtab.html/css/js # New tab page (hero Jesty + search)
│   ├── sidepanel.html/css/js # Talk back chat interface
│   ├── popup.html/css/js  # Feed Jesty support page
│   ├── storage.js         # Persistent storage module
│   ├── config.js          # API key (gitignored)
│   ├── config.example.js  # Template for config
│   └── icons/             # Extension icons
├── 1. Docs/
│   ├── METRICS.md         # Analytics tracking plan
│   ├── USER_JOURNEY.md    # First-time user experience
│   ├── DATA_SCHEMA.md     # Storage schema documentation
│   ├── ILLUSTRATION_BRIEFING.md # Character design specs
│   └── ...
└── ...
```

## Setup

1. Copy `config.example.js` to `config.js`
2. Add your OpenAI API key to `config.js`
3. Load `0. Source/` folder as unpacked extension in Chrome (`chrome://extensions`)

## Key Files

- `newtab.js` - Main roast generation, system prompt, personalization
- `sidepanel.js` - Conversation handling, chat with Jesty
- `storage.js` - All persistent data (roasts, conversations, patterns, milestones)
- `config.js` - OpenAI API key (never commit)

## Prompt System

**Tones** (randomly selected):
- Sarcastic, Funny, Assertive, Savage, Naughty, Wholesome, Proud Roast

**Analysis approaches**:
- Contradiction (mix 2 unrelated tabs)
- Single quirk (one weird/forgotten tab)
- Pattern (cluster of similar tabs)
- Mundane roast (call out the obvious)

**Rules**:
- Max 12 words, must fit 2 lines
- Be specific (name actual sites, topics)
- Varied endings (questions, commands, observations)
- Never mention tab counts
- Avoid recently roasted topics

## Character Expressions (10 total)

| Expression | When Used | Mood |
|------------|-----------|------|
| smug | Default, delivered a good roast | Confident |
| suspicious | Caught sketchy behavior | Investigative |
| yikes | Awkward/embarrassing tabs | Shocked |
| eyeroll | Predictable behavior (Reddit again) | Bored |
| disappointed | Expected better | Sad |
| melting | Chaotic mess, overwhelmed | Dizzy |
| dead | Brutal roast, destroyed | RIP |
| thinking | Loading state | Curious |
| happy | Milestone, user supported | Celebrating |
| hungry | Feed Jesty popup | Begging |

## Storage System

All data persists locally via `chrome.storage.local`:

- **Profile**: User patterns, trait scores, category stats
- **Roasts**: Last 100 roasts with context
- **Conversations**: Last 50 side panel threads
- **Milestones**: Achievement timestamps, streaks
- **Settings**: Preferences

## Design

- White background, minimal Google-style
- Hero character centered
- DM Sans font
- Lime yellow character (#EBF34F)
- Fluid blob body shapes (not geometric)
