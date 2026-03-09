# Jesty

A Chrome extension that reads your open tabs and delivers short, witty roasts using AI. Features a hero character with expressive moods, a chat interface to argue back, and a personalized experience that learns your browsing habits.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                         │
│                        (Manifest V3)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ New Tab  │  │  Side Panel  │  │  Background  │              │
│  │  Page    │  │  (Chat +     │  │  (Service    │              │
│  │          │  │   Tasks +    │  │   Worker)    │              │
│  │          │  │   Games)     │  │              │              │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘              │
│       │               │                 │                       │
│       ▼               ▼                 │                       │
│  ┌─────────────────────────────────────────┐                    │
│  │           Shared Modules                │                    │
│  │  ┌─────────────┐  ┌──────────────────┐ │                    │
│  │  │ RoastEngine │  │ JestyStorage     │◄├────────────────────┘
│  │  │ (AI + ctx)  │  │ (chrome.storage) │ │                    │
│  │  └──────┬──────┘  └──────────────────┘ │                    │
│  │         │                               │                    │
│  │  ┌──────┴──────┐  ┌──────────────────┐ │                    │
│  │  │ JestyPremium│  │ JestyAccessories │ │                    │
│  │  │ (tier gate) │  │ (cosmetics)      │ │                    │
│  │  └─────────────┘  └──────────────────┘ │                    │
│  │  ┌─────────────┐  ┌──────────────────┐ │                    │
│  │  │ JestyCalendar│ │ JestyAnimator   │ │                    │
│  │  │ (Pro only)  │  │ (sidepanel only)│ │                    │
│  │  └─────────────┘  └──────────────────┘ │                    │
│  │  ┌─────────────┐  ┌──────────────────┐ │                    │
│  │  │ Characters  │  │ Theme           │ │                    │
│  │  │ (SVG defs)  │  │ (light/dark)    │ │                    │
│  │  └─────────────┘  └──────────────────┘ │                    │
│  │  ┌─────────────┐  ┌──────────────────┐ │                    │
│  │  │ Fun Zone    │  │ Focus Time      │ │                    │
│  │  │ (3 games)   │  │ (distraction    │ │                    │
│  │  │             │  │  blocker)       │ │                    │
│  │  └─────────────┘  └──────────────────┘ │                    │
│  └─────────────────────────────────────────┘                    │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌─────────┐
        │ OpenAI   │ │ Google │ │ Real-   │
        │ API      │ │ Cal    │ │ time    │
        │(GPT-4o-  │ │ API    │ │ APIs    │
        │ mini)    │ │(Pro)   │ │(crypto, │
        └──────────┘ └────────┘ │weather, │
                                │sports)  │
                                └─────────┘
```

## Surfaces & User Flows

### 1. New Tab Page (`newtab.*`)
```
Open new tab
  → First visit? Show welcome prompt (name + color)
  → RoastEngine.generate()
    → Fetch tabs → Build context → Call OpenAI → Parse mood
    → Display roast + set character expression
    → Check milestone (25/60/100/500/1000)
  → User actions:
    ├── "Talk Back" → Opens side panel, loads roast into chat drawer
    ├── "Share" → Generates branded image (includes accessories) → Share API
    ├── "Refresh" → Re-generates roast
    └── Google search bar → Navigate
  → Background listener: tab closed that was roasted?
    → Show celebration message + thumbs animation
```

### 2. Side Panel (`sidepanel.*`)
```
Open side panel
  → Load last roast into chat drawer (if recent)
  → Start live comments (30-60s intervals)
    ├── 20% chance: Real AI roast via RoastEngine (primes chat)
    ├── Domain-specific quip (YouTube, Reddit, etc.)
    ├── Tab count comment (30+, 50+, 100+)
    └── Generic observation
  → User actions:
    ├── "Roast me now" → Opens new tab (roast happens there)
    ├── Pencil icon → Settings panel (name + face-based color picker + theme)
    ├── Chat drawer (drag/tap to open)
    │   ├── Type message → OpenAI chat with JESTY_PERSONALITY
    │   ├── 3rd reply: Jesty gives a specific tab task/dare
    │   └── Unified daily cap: 12 interactions/day (free), unlimited (premium)
    ├── Promo card → Tier overlay (slot machine + plans)
    ├── Stat pills → Tier overlay (all clickable)
    └── Accessories grid → Equip/unequip cosmetics
  → Premium features (if Guilty/Sentenced):
    ├── Focus Time → Distraction blocker with floating island iframe
    │   ├── Island: face circle + timer badge, hover reveals eye/pencil/end-focus
    │   ├── Eye button: toggle sidepanel open/close (via windowId)
    │   ├── Pencil button: open sidepanel in focus-note mode, highlight input
    │   ├── End focus: smooth "End focus" → fade → "Done!" → wait → end session
    │   └── Same iframe (`focus-island.html`) on all tabs including new tab
    ├── Task Card → User tasks with structured notes (checklist)
    │   ├── Empty state with add button when no tasks
    │   ├── Task detail drawer: title, checklist notes, Done/Delete
    │   ├── Notes: array of {text, done} with inline editing
    │   ├── Auto-suggested tasks (close tabs challenges) → XP reward
    │   └── Animated delete (slide-left + collapse)
    ├── Fun Zone → Memory Match, Tab Quiz, Roast Trivia (3 games)
    ├── XP Bar → Level progression → Unlock accessories
    ├── Wall of Shame / Hall of Fame → Stats
    ├── Schedule Card (Pro) → Google Calendar events
    └── Daily Report (Pro) → AI-generated day summary
```

### 3. Background Service Worker (`background.js`)
```
Always running:
  ├── Tab tracking: cache open tabs (domain, URL, title)
  ├── Action detection: tab closed → was it roasted in last 10min?
  │   └── Yes → Create celebration + pending XP → newtab picks it up
  ├── Payment detection: Stripe success URL → activate premium
  ├── Focus Mode check (alarm, ~10s): block distraction domains
  ├── Daily report check (alarm, hourly): generate at 9 PM
  ├── Subscription validation (alarm, daily): check expiry
  └── Cleanup (alarm, 5min): expire old roasted domains
```

## File Reference

| File | Purpose | Depends on |
|------|---------|------------|
| `manifest.json` | Extension config (MV3), permissions, surfaces | — |
| `background.js` | Service worker: tab tracking, payments, alarms, focus mode | storage, premium |
| `newtab.js` | New tab roast display, welcome flow, sharing (with accessories) | characters, storage, premium, accessories, calendar, roast-engine, theme |
| `newtab.html` | New tab page markup | newtab.css |
| `newtab.css` | New tab page styles | — |
| `sidepanel.js` | Chat, live comments, settings, tasks, fun zone, premium UI, tier overlay | characters, storage, premium, accessories, calendar, character-animator, roast-engine, memory-game, tab-quiz, roast-trivia, focus-time, theme |
| `sidepanel.html` | Side panel markup (main screen, drawers, overlays) | sidepanel.css |
| `sidepanel.css` | Side panel styles (~3800 lines) | — |
| `roast-engine.js` | AI roast generation, real-time context, mood parsing, profile-based mood selection | config, storage, premium, calendar |
| `storage.js` | All persistence: profile, roasts, conversations, milestones, schema migrations | chrome.storage.local |
| `premium.js` | Tier gating (Suspect/Guilty/Sentenced), feature checks | storage |
| `characters.js` | SVG symbol definitions (15 faces, 11 accessories) | — |
| `character-animator.js` | Walk/blink/expression animation loop (sidepanel only) | characters, accessories |
| `accessories.js` | Cosmetic system: equip, unlock, evolution stages | storage, characters |
| `calendar.js` | Google Calendar OAuth, event fetching (Pro) | chrome.identity |
| `theme.js` | Light/dark theme system | chrome.storage (jestyThemePreference) |
| `focus-time.js` | Focus timer management, session tracking | storage |
| `focus-island.js` | Focus mode island: face, timer, hover actions (eye/pencil), end session | characters, theme, chrome.storage |
| `focus-island.html` | Focus mode island markup (shared iframe on all tabs including new tab) | focus-island.css |
| `focus-island.css` | Focus mode island styles (JS-driven `.hovered` class, not CSS `:hover`) | — |
| `focus-content.js` | Content script: injects island iframe on web pages during focus | chrome.storage (focusSession) |
| `memory-game-tab.js` | Memory Match browser tab game logic (extracted for MV3 CSP) | characters |
| `memory-game.js` | Memory Match game (pair-matching with faces) | characters, storage (jestyFunZone) |
| `tab-quiz.js` | Tab Quiz game (test knowledge of open tabs) | storage (jestyFunZone) |
| `roast-trivia.js` | Roast Trivia game (remember past roasts) | storage (jestyFunZone) |
| `character-sheet.html` | Dev tool: interactive viewer for all 15 expressions × 6 colors | characters |
| `config.js` | OpenAI API key (gitignored) | — |
| `privacy.html` | Privacy policy page | — |

## Monetization Tiers

| Tier | Name | Price | Limits | Features |
|------|------|-------|--------|----------|
| Free | Suspect | $0 | 12 interactions/day (roasts + chat shared) | Basic roasts, 7 moods, 3 accessories |
| Premium | Guilty | $5 once | Unlimited | +3 moods (impressed, manic, petty), Focus Time, Tasks, Fun Zone, XP, Records, Daily Report, +5 accessories |
| Pro | Sentenced | $5/mo | Unlimited | +3 moods (chaotic, dramatic, tender), Google Calendar, schedule-aware roasts, evolution, +3 accessories |

## Prompt System

**Roast angles** (RoastEngine picks one):
- Identity read, Contradiction, Hype, Push to finish, Guilty pleasure
- Obsession, Weird detail, Life narration, Supportive roast, Real-talk

**Moods** (AI returns one, influenced by profile-based selection):
- Free: smug, suspicious, yikes, eyeroll, disappointed, melting, dead
- Premium: +impressed, manic, petty
- Pro: +chaotic, dramatic, tender

**Profile-based mood biases** (`pickMoodFromProfile()`):
- Late night → suspicious, disappointed
- High tab count → melting, eyeroll
- Work hours procrastination → disappointed, eyeroll
- Impulse shopping → yikes, smug
- Streaks → smug, dead

**Rules**: Max 12 words, 2 lines. Be specific. Vary endings. No emojis. No tab counts. Avoid recent topics.

**Real-time context**: Weather (geolocation), crypto prices, sports scores, market status, holidays, package tracking, food delivery timing

## Character Expressions (15)

| Expression | Tier | When Used |
|------------|------|-----------|
| smug | Free | Default, good roast delivered |
| suspicious | Free | Caught sketchy behavior |
| yikes | Free | Awkward/embarrassing tabs |
| eyeroll | Free | Predictable behavior |
| disappointed | Free | Expected better |
| melting | Free | Chaotic mess |
| dead | Free | Brutal roast |
| impressed | Premium | Genuinely taken aback |
| manic | Premium | Unhinged energy |
| petty | Premium | Nitpicky detail |
| chaotic | Pro | Fever dream energy |
| dramatic | Pro | Soap opera reaction |
| tender | Pro | Rare soft moment |
| thinking | System | Loading/generating |
| happy | System | Milestone, celebration |

## Storage Schema (v1.3)

All data in `chrome.storage.local` under `jesty_data`:

- **profile**: user_id, total_roasts, patterns (hours, days, avg/peak tabs), top_categories, traits (procrastinator, night_owl, impulse_shopper, tab_hoarder), user_name
- **roasts[]**: Last 100 — id, text, mood, context, topics, shared/refreshed flags
- **conversations[]**: Last 50 — messages, sentiment, trigger_roast_id
- **milestones**: Roast counts, streaks, achievements, action tracking
- **settings**: Caps, tier, subscription status
- **progression**: Level, XP, xp_to_next, total_xp, evolution_stage
- **records**: wall_of_shame, hall_of_fame
- **daily_reports[]**: Last 7 AI-generated summaries
- **focus_sessions[]**: Focus Time session history (startedAt, endedAt, distractionCount, longestStreakSeconds)
- **user_tasks[]**: User-created tasks with structured notes

### User Task Schema
```js
{
  id: "user_" + Date.now(),
  title: "Task title",
  notes: [                    // Array of checklist items
    { text: "Note text", done: false },
    { text: "Done item", done: true }
  ],
  completed: false,
  completedAt: null,          // Timestamp when completed
  createdAt: Date.now()
}
```

**Backward compat**: `migrateTaskNotes(task)` converts old string notes to `[{ text, done: false }]` on load.

**Empty task cleanup**: Tasks with no title and no notes are never persisted. `isTaskEmpty()` checks on close; `createAndOpenTask()` defers save until content is added.

### Separate Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `jestyColor` | `{body, limb, shadow, highlight}` | Character color preference |
| `jestyThemePreference` | `"light" \| "dark"` | Theme preference |
| `lastRoast` | String | Most recent roast text |
| `lastRoastId` | UUID | ID of last roast |
| `lastRoastTime` | Milliseconds | Timestamp of last roast |
| `roastedDomains` | `[{domain, expiresAt}]` | Domains roasted in last 10 min |
| `openTabs` | `{[tabId]: {tabId, domain, url, title, firstSeen, lastActivated}}` | Real-time tab cache |
| `currentTask` | Object | Auto-suggested task (premium) |
| `taskStartTabCount` | Number | Tab count at task assignment |
| `pendingXPGain` | `{xp, domain, timestamp}` | XP waiting to be claimed |
| `focusSession` | Object | Active focus time session state |
| `sessionStartTime` | Milliseconds | Service worker start time |
| `loadRoastIntoChat` | `{text, roastId, timestamp}` | Signal: newtab → sidepanel |
| `sidePanelOpenMode` | `"chat" \| "accessories" \| "levels" \| "focus-note"` | Signal: open sidepanel to specific view |
| `sidePanelOpenAt` | Milliseconds | Timestamp of sidepanel open request |
| `focusNoteRequest` | Milliseconds | Signal: island pencil → sidepanel focus note input |
| `jestyFunZone` | `{memoryGame: {...}}` | Games progression data |
| `lastBriefingDate` | `"YYYY-MM-DD"` | Last daily report date (Pro) |

**Daily cap**: Unified counter (`roasts_today`) shared by new tab roasts and chat messages. Resets at user's local midnight via `getLocalDate()`. Live inline roasts (passive, ~20% chance) are free and don't count. Counter syncs across surfaces via `chrome.storage.onChanged`. `visibilitychange` listener re-checks on return from sleep.

### Schema Migrations
- **1.0 → 1.1**: Daily cap tracking (roasts_today, chats_today)
- **1.1 → 1.2**: Progression/Tamagotchi, Records, Daily Reports, Subscription fields
- **1.2 → 1.3**: Focus Sessions history (focus_sessions array)

## Design System

- White background, minimal Google-style (supports light/dark theme)
- DM Sans font family
- 6 character colors: Lime (#EBF34F), Pink (#FF8FA3), Sky (#87CEEB), **Purple (#A78BFA, default)**, Mint (#34D399), Peach (#FDBA74)
- Color picker uses face-based illustrations (random expressions each open)
- Fluid blob body shapes (organic, not geometric)
- Dark UI accents: #18181B (buttons, text), white backgrounds
- SVG source color is Lime; recolored at runtime via color replacement maps
- Section cards use `var(--jesty-bg-tertiary)` background with 14px border-radius
- Button styles: Primary (dark pill, `var(--jesty-btn-bg)`), Secondary (outline, `1.5px solid var(--jesty-border)`)

## Setup

1. Copy `config.example.js` to `config.js`
2. Add your OpenAI API key to `config.js`
3. Load `0. Source/` folder as unpacked extension in Chrome (`chrome://extensions`)
