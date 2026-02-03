# Jesty Strategy

> **Status:** Draft - Work in progress

## Core Concept

**Problem:** Users have too many tabs open, leading to distraction and reduced productivity.

**Solution:** Jesty roasts you about your tabs, making you aware of the problem in a fun way. Premium users can "talk back" and get help actually fixing it.

**Positioning:** Entertainment → Productivity tool

---

## Product Tiers

### Free Tier
- Unlimited roasts on new tab
- One-liner judgments based on tab content
- Shareable roast cards (viral growth)
- Character with expressions

### Premium Tier ($5 one-time)
- Everything in Free
- **"Talk Back" feature** - Side panel chat with Jesty
- Conversation modes:
  - **Argue mode**: Fight back, Jesty defends the roast
  - **Help mode**: "Which tabs should I close?"
  - **Accountability mode**: Jesty checks back on you
- Productivity tracking: "You've closed X tabs this month"

---

## User Journey

```
Day 1: Install → Gets roasted → Laughs → Hook
Day 3-7: Daily roasts → Shares with friends → Habit
Day 7+: Wants to argue → Hits premium wall → Converts
```

| Stage | Experience | Goal |
|-------|------------|------|
| Discovery | Funny roast on new tab | Hook |
| Habit | Daily roasts, shares | Retention |
| Conversion | "Talk back" teaser | Revenue |

---

## Monetization

### Pricing
- **$5 one-time** lifetime access
- Impulse buy, no commitment
- One paying user funds ~2,500 free roasts

### Revenue Math
| Metric | Value |
|--------|-------|
| Cost per roast | ~$0.001 |
| Cost per conversation | ~$0.01-0.02 |
| Revenue per premium user | ~$4.60 (after Stripe) |
| Roasts funded per sale | ~2,500 |

### Payment Flow
1. User clicks "Go Premium"
2. Chrome Identity API gets Google email
3. Redirect to Stripe checkout (email prefilled)
4. On success, email added to premium list
5. Extension checks premium status on load

---

## Technical Architecture

### User Identification
- Chrome Identity API (free, seamless)
- User's Google account email
- No signup friction

### Premium Database
- Google Sheets + Apps Script (free)
- Simple email lookup
- Upgrade to Firebase/Supabase if needed

### Components
| Component | Purpose |
|-----------|---------|
| New Tab page | Main roast experience |
| Popup | "Feed Jesty" support page |
| Side Panel | Premium chat interface |

---

## Growth Strategy

### Viral Loops
- **Shareable roast cards**: Branded images for social
- "Jesty said this about my tabs" → friends install

### Channels
| Channel | Strategy |
|---------|----------|
| Organic social | Screenshots of brutal roasts |
| Product Hunt | Launch for visibility |
| Chrome Web Store | SEO: productivity, tab manager, funny |
| Word of mouth | It's funny, people share |
| TikTok/Reels | Short videos of roasts |

### Metrics to Track
- Daily active users
- Roasts per user
- Share rate
- Free → Premium conversion rate
- Premium retention

---

## Competitive Advantage

1. **Personality**: Not another boring tab manager
2. **Fun first**: Entertainment that becomes useful
3. **Low friction**: Works on new tab, no action needed
4. **Viral potential**: Funny = shareable
5. **Simple premium**: One feature worth paying for

---

## Open Questions

- [ ] Exact copy for premium conversion CTA
- [ ] Side panel chat UX details
- [ ] Roast card design for sharing
- [ ] Launch timing and Product Hunt strategy
- [ ] Accountability mode mechanics
- [ ] Track tab closing? Privacy implications?

---

## Next Steps

1. Finalize premium feature (Talk Back) UX
2. Build side panel chat prototype
3. Set up Chrome Identity + Google Sheets backend
4. Create shareable roast cards
5. Design premium conversion flow
6. Beta test with friends
7. Product Hunt launch

---

*Last updated: Work in progress*
