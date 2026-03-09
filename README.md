# Graduate Studies Language Proficiency Assessment

**University of the Nations / YWAM**

A voice-based ACTFL Oral Proficiency Interview application for graduate admissions. Built with Next.js, Anthropic Claude (multi-agent), and ElevenLabs TTS.

---

## Architecture

Five specialized AI agents run in sequence:

| Agent | Role |
|---|---|
| **Intake Agent** | Friendly conversation to gather applicant background |
| **Placement Agent** | Estimates starting probe level from background data |
| **Interviewer Agent** | Conducts the OPI, probes up/down per ACTFL criteria |
| **Scoring Logic** | Embedded in Interviewer — tracks floor/ceiling per response |
| **Report Agent** | Synthesizes a final level, strengths, and admissions recommendation |

The app uses:
- **Anthropic Claude** (`claude-sonnet-4-20250514`) for all agents
- **ElevenLabs** `eleven_multilingual_v2` for natural TTS (falls back to browser TTS)
- **Web Speech API** for STT (Chrome/Edge; falls back to text input)

---

## ACTFL Levels Assessed

```
Novice Low / Mid / High
Intermediate Low / Mid / High
Advanced Low / Mid / High
Superior
Distinguished
```

Graduate admissions thresholds:
- **Ready** → Advanced Low or above
- **Conditionally Ready** → Intermediate High
- **Needs Development** → Intermediate Mid or below

---

## Quick Start (Local)

```bash
git clone https://github.com/YOUR_ORG/graduate-language-assessment.git
cd graduate-language-assessment
npm install
cp .env.example .env.local
# Edit .env.local with your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...          # Required
ELEVENLABS_API_KEY=...                # Optional (falls back to browser TTS)

# Optional: per-language ElevenLabs voice IDs
# All default to Rachel (21m00Tcm4TlvDq8ikWAM), which handles all languages
# via eleven_multilingual_v2. Replace with any voice ID from your ElevenLabs account.
ELEVENLABS_VOICE_EN=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_VOICE_ES=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_VOICE_PT=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_VOICE_FR=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_VOICE_KO=21m00Tcm4TlvDq8ikWAM
```

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_ORG/graduate-language-assessment.git
git push -u origin main
```

### 2. Import on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Framework: **Next.js** (auto-detected)
4. Add environment variables in Vercel settings:
   - `ANTHROPIC_API_KEY`
   - `ELEVENLABS_API_KEY` (optional)
   - Any `ELEVENLABS_VOICE_*` overrides
5. Click **Deploy**

---

## Adding More Languages

In `app/page.js`, add to the `LANGUAGES` array:

```js
{ id: 'arabic', label: 'العربية', flag: '🇸🇦', sttLang: 'ar-SA', ttsLang: 'ar' },
{ id: 'hindi',  label: 'हिन्दी',  flag: '🇮🇳', sttLang: 'hi-IN', ttsLang: 'hi' },
```

In `app/api/tts/route.js`, add to `VOICE_ENV`:

```js
arabic: 'ELEVENLABS_VOICE_AR',
hindi:  'ELEVENLABS_VOICE_HI',
```

Add the corresponding env var to `.env.local` and Vercel settings.

---

## Customizing Assessment Behavior

All agent logic is in `app/api/agent/route.js`:

- **Placement logic** — edit `placementPrompt()` to adjust starting level rules
- **Interview questions** — edit the topic list inside `interviewerPrompt()`
- **Probe logic** — adjust the floor/ceiling rules in the `POST` handler's interview section
- **Admissions thresholds** — edit `reportPrompt()` threshold descriptions

---

## Browser Support

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Voice input (STT) | ✅ | ✅ | ❌ | ⚠️ |
| TTS (ElevenLabs) | ✅ | ✅ | ✅ | ✅ |
| Text input fallback | ✅ | ✅ | ✅ | ✅ |

**Recommendation for testing:** Use Chrome. The app auto-detects STT availability and offers a text-input fallback.

---

## License

University of the Nations internal use. All rights reserved.
