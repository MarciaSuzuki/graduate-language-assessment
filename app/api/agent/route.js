import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── ACTFL Level helpers ──────────────────────────────────────────────────────

const LEVELS = [
  'novice_low','novice_mid','novice_high',
  'intermediate_low','intermediate_mid','intermediate_high',
  'advanced_low','advanced_mid','advanced_high',
  'superior','distinguished',
];

function idx(level) { return LEVELS.indexOf(level); }

function shiftLevel(level, delta) {
  const i = Math.max(0, Math.min(LEVELS.length - 1, idx(level) + delta));
  return LEVELS[i];
}

// ── System prompts ───────────────────────────────────────────────────────────

function intakePrompt(language) {
  return `You are a warm, professional voice interviewer for the University of the Nations (UofN/YWAM) Graduate Studies Language Proficiency Assessment in ${language}.

Your task: Have a brief, friendly conversation to learn about the applicant before the formal language assessment begins. You are speaking via voice, so keep every response to 2–3 natural sentences — no bullet points, no lists.

Gather the following over 4–6 exchanges (don't rush, be conversational):
1. Their name
2. Country of origin and cultural/linguistic background
3. How long they have been using or studying ${language}
4. Their ministry, professional, or academic purpose for needing ${language}

Be warm and affirming. Welcome them to the University of the Nations. Do NOT ask linguistic test questions yet.

When you have gathered all four points, append exactly: [[INTAKE_COMPLETE]]

Output ONLY natural spoken text. No markdown, no labels.`;
}

function placementPrompt(language) {
  return `You are an ACTFL OPI examiner. Based on the intake conversation summary below, determine the best starting probe level for a ${language} oral proficiency interview.

Respond with ONLY raw JSON (no markdown fences, no extra text):
{"startingLevel":"","rationale":"","transitionText":""}

startingLevel must be one of: novice_low novice_mid novice_high intermediate_low intermediate_mid intermediate_high advanced_low advanced_mid advanced_high superior

rationale: one sentence explaining your choice.

transitionText: 2–3 warm, voice-friendly sentences in ${language} (or English if ${language} is English) that: (a) acknowledge the applicant's background, (b) explain that the formal language assessment is starting now, (c) invite them to speak naturally.

PLACEMENT GUIDELINES (err one level below your estimate to establish floor properly):
• No formal study / very limited use → intermediate_low (graduate floor)
• 1–3 years formal study → intermediate_mid
• 3–5 years or time spent living in a ${language}-speaking country → intermediate_high
• 5+ years of professional / ministry use → advanced_low
• Near-native competence → advanced_mid`;
}

function interviewerPrompt(language, state) {
  const {
    currentLevel = 'intermediate_mid',
    questionsAtLevel = 0,
    totalQuestions = 0,
    floorLevel,
    ceilingLevel,
    scoringNotes = [],
  } = state;

  return `You are an ACTFL Oral Proficiency Interview (OPI) examiner conducting a ${language} proficiency assessment for a University of the Nations graduate applicant.

── CURRENT STATE ──
Probe level     : ${currentLevel}
Questions at this level: ${questionsAtLevel}
Total questions : ${totalQuestions}
Floor (highest sustained): ${floorLevel ?? 'not yet established'}
Ceiling (first breakdown): ${ceilingLevel ?? 'not yet established'}
Last 3 scoring notes: ${scoringNotes.slice(-3).join(' | ') || 'none yet'}

── ACTFL PROFICIENCY CRITERIA ──

NOVICE (Low/Mid/High)
• Isolated words, memorized phrases only — no real sentence creation
• Familiar topics: greetings, numbers, colors, immediate needs
• Cannot sustain a conversation; relies on repetition and gestures

INTERMEDIATE Low
• Creates simple sentences beyond memorization
• Handles basic personal questions (family, daily routine)
• Present tense; very familiar topics; sentence-level language

INTERMEDIATE Mid
• Handles simple conversational exchanges
• Some attempts at past or future reference
• Able to describe familiar situations; mostly sentence-level

INTERMEDIATE High
• Handles unexpected complications
• Paragraph-level attempts; narrates simple events
• May break down on abstract or unfamiliar topics

ADVANCED Low
• Narrates and describes in past, present, and future
• Paragraph-level discourse; handles complications with effort
• Some gaps in tense consistency or discourse organization

ADVANCED Mid
• Sustained paragraph-level narrative on concrete topics
• Beginning to engage abstract topics; good tense control
• Well-organized discourse; handles most familiar situations easily

ADVANCED High
• Discusses abstract topics; supports opinions
• Extended, organized discourse
• Occasional precision errors near Superior boundary

SUPERIOR
• Precise, nuanced handling of abstract/professional topics
• Hypothesizes, argues positions, discusses concepts
• Well-organized extended discourse; near-native pragmatics

DISTINGUISHED
• Sophisticated rhetorical precision; audience-tailored language
• Effectively approximates educated native speaker
• Nuanced cultural and register competence

── YOUR TASK ──
1. Acknowledge the student's previous response naturally (1 sentence, conversational).
2. Ask ONE new question calibrated to the current probe level (see topics below).
3. Keep your entire output to 2–4 sentences — this is a voice conversation.
4. Evaluate the student's previous response against the ACTFL criteria above.
5. Decide probe direction.

PROBE LOGIC:
• 3 strong responses at this level → probe UP (raise currentLevel by 1)
• 2 clearly weak responses at this level → probe DOWN (lower by 1)
• One striking mismatch (far above or below) → adjust immediately
• End conditions: both floor AND ceiling established, OR totalQuestions ≥ 20

SAMPLE QUESTION TOPICS BY LEVEL:
novice       : "What is your name? What country are you from? What do you like to eat?"
int_low      : "Tell me about your family. What do you do every day?"
int_mid      : "Describe your hometown. What did you do last weekend?"
int_high     : "Tell me about a challenge you faced. What would you do if a problem arose at work?"
adv_low      : "Tell me the story of how you came to your current ministry or work. How did that situation develop over time?"
adv_mid      : "What do you see as the main challenges in cross-cultural ministry? How do language barriers affect that work?"
adv_high     : "Discuss the relationship between language and cultural identity. What is your philosophy of language learning?"
superior     : "Analyze the linguistic and theological challenges of translating Scripture for oral, zero-literacy communities. Defend a methodology."
distinguished: "How do competing translation theories — formal equivalence versus functional equivalence — reflect broader epistemological commitments? Evaluate their practical implications for minority language communities."

Respond with ONLY raw JSON (no markdown fences, no extra text):
{
  "agentText": "Acknowledgment + question in natural voice speech",
  "probeDirection": "up|maintain|down|end",
  "levelIndicator": "${currentLevel}",
  "scoringNote": "Brief note: text type produced, grammar control, vocabulary range, fluency observed",
  "shouldEnd": false
}`;
}

function reportPrompt(language, state) {
  const { currentLevel, floorLevel, ceilingLevel, scoringNotes = [], totalQuestions } = state;
  return `You are an ACTFL OPI examiner writing the final proficiency assessment report for a ${language} interview conducted for University of the Nations Graduate Studies admissions.

INTERVIEW DATA:
• All scoring notes (chronological): ${scoringNotes.join(' | ')}
• Floor level (highest sustained):   ${floorLevel ?? currentLevel}
• Ceiling level (first breakdown):   ${ceilingLevel ?? 'not clearly established'}
• Final probe level:                 ${currentLevel}
• Total questions administered:      ${totalQuestions}

ADMISSIONS THRESHOLDS:
• "ready"              → Advanced Low or above  (handles graduate academic discourse)
• "conditionally_ready"→ Intermediate High      (sufficient with language support plan)
• "needs_development"  → Intermediate Mid or below (not yet ready for graduate-level study in this language)

Respond with ONLY raw JSON (no markdown fences, no extra text):
{
  "finalLevel": "e.g. advanced_low",
  "levelDisplay": "e.g. Advanced Low",
  "summary": "2–3 sentence overview of overall performance",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "areasForGrowth": ["area 1", "area 2"],
  "admissionsRecommendation": "ready|conditionally_ready|needs_development",
  "admissionsNote": "1–2 sentence note for the admissions committee",
  "closingText": "Warm 2–3 sentence spoken message to the applicant: affirm their effort, mention they will be notified of results, and encourage them."
}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse JSON from response');
  }
}

async function callClaude(system, messages, maxTokens = 800) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system,
    messages,
  });
  return response.content[0].text;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.json();
    const { phase, language, history = [], state = {}, userInput } = body;

    // ── INTAKE ──────────────────────────────────────────────────────────────
    if (phase === 'intake') {
      const system = intakePrompt(language);
      const msgs = userInput
        ? [...history, { role: 'user', content: userInput }]
        : [{ role: 'user', content: 'Hello, I am here for my language assessment.' }];

      const text = await callClaude(system, msgs);
      const isComplete = text.includes('[[INTAKE_COMPLETE]]');
      const agentText = text.replace('[[INTAKE_COMPLETE]]', '').trim();

      return NextResponse.json({ success: true, data: { agentText, isComplete } });
    }

    // ── PLACEMENT ───────────────────────────────────────────────────────────
    if (phase === 'placement') {
      const system = placementPrompt(language);
      const summary = history.map(m => `${m.role}: ${m.content}`).join('\n');
      const msgs = [{ role: 'user', content: `Intake conversation:\n${summary}` }];

      const text = await callClaude(system, msgs);
      const data = safeParseJSON(text);

      return NextResponse.json({ success: true, data });
    }

    // ── INTERVIEW ───────────────────────────────────────────────────────────
    if (phase === 'interview') {
      const system = interviewerPrompt(language, state);
      let msgs;
      if (!userInput) {
        // First question: no prior interview history
        msgs = [{ role: 'user', content: 'Please begin the interview with your first question.' }];
      } else {
        msgs = [...history, { role: 'user', content: userInput }];
      }

      const text = await callClaude(system, msgs, 600);
      const data = safeParseJSON(text);

      // Update state with probe logic
      const newState = { ...state };
      newState.totalQuestions = (state.totalQuestions || 0) + (userInput ? 1 : 0);
      newState.scoringNotes = [...(state.scoringNotes || [])];
      if (data.scoringNote && userInput) newState.scoringNotes.push(data.scoringNote);

      if (data.probeDirection === 'up') {
        if (!newState.floorLevel) newState.floorLevel = state.currentLevel;
        newState.currentLevel = shiftLevel(state.currentLevel, 1);
        newState.questionsAtLevel = 0;
      } else if (data.probeDirection === 'down') {
        if (!newState.ceilingLevel) newState.ceilingLevel = state.currentLevel;
        newState.currentLevel = shiftLevel(state.currentLevel, -1);
        newState.questionsAtLevel = 0;
      } else if (data.probeDirection === 'end') {
        data.shouldEnd = true;
      } else {
        newState.questionsAtLevel = (state.questionsAtLevel || 0) + 1;
      }

      if (newState.totalQuestions >= 20) data.shouldEnd = true;

      return NextResponse.json({ success: true, data, newState });
    }

    // ── REPORT ──────────────────────────────────────────────────────────────
    if (phase === 'report') {
      const system = reportPrompt(language, state);
      const msgs = [{ role: 'user', content: 'Generate the final assessment report.' }];

      const text = await callClaude(system, msgs, 1200);
      const data = safeParseJSON(text);

      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: 'Unknown phase' }, { status: 400 });

  } catch (error) {
    console.error('Agent route error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
