# Language Assessment Interview

**University of the Nations / YWAM**

This app is a general-purpose oral proficiency interview for assessing a speaker's current level in a language. It keeps the UofN branding, starts every interview at **Novice Low**, and moves upward through the ACTFL ladder until it identifies the highest level the speaker can sustain.

## Purpose

- Assess current oral proficiency in a selected language
- Use a progressive ACTFL-style interview from novice through advanced levels
- Provide a clear final proficiency result, strengths, growth areas, and next target
- Keep the report focused on proficiency and growth only

## Progressive Ladder

```text
Novice Low -> Novice Mid -> Novice High
-> Intermediate Low -> Intermediate Mid -> Intermediate High
-> Advanced Low -> Advanced Mid -> Advanced High
-> Superior -> Distinguished
```

The interview can stay at the same level, move up one level, or move down one level to confirm a ceiling. It does not skip levels.

## Quick Start

```bash
cd /Users/marciasuzuki/Documents/New\ project/graduate-language-assessment-novice-to-advanced
npm install
cp .env.example .env.local
# add your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=

ELEVENLABS_VOICE_EN=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_VOICE_ES=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_VOICE_PT=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_VOICE_FR=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_VOICE_KO=21m00Tcm4TlvDq8ikWAM
```

`ELEVENLABS_API_KEY` is optional. The app falls back to browser speech synthesis when ElevenLabs is not configured.

## Key Files

- `app/page.js` controls the interview flow and results UI
- `app/api/agent/route.js` contains the intake, transition, interview, and report prompts
- `app/api/tts/route.js` handles ElevenLabs or browser TTS fallback

## Browser Support

- Chrome / Edge: voice input + TTS
- Firefox / Safari: text-input fallback + TTS

## Notes

This clone lives separately from the original app folder:

- Original source clone: `/Users/marciasuzuki/Documents/New project/graduate-language-assessment`
- Current interview app: `/Users/marciasuzuki/Documents/New project/graduate-language-assessment-novice-to-advanced`
