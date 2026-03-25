import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LEVELS = [
  'novice_low', 'novice_mid', 'novice_high',
  'intermediate_low', 'intermediate_mid', 'intermediate_high',
  'advanced_low', 'advanced_mid', 'advanced_high',
  'superior', 'distinguished',
];

const LEVEL_DISPLAY = {
  novice_low: 'Novice Low',
  novice_mid: 'Novice Mid',
  novice_high: 'Novice High',
  intermediate_low: 'Intermediate Low',
  intermediate_mid: 'Intermediate Mid',
  intermediate_high: 'Intermediate High',
  advanced_low: 'Advanced Low',
  advanced_mid: 'Advanced Mid',
  advanced_high: 'Advanced High',
  superior: 'Superior',
  distinguished: 'Distinguished',
};

const MAX_QUESTIONS = 24;

function idx(level) {
  return LEVELS.indexOf(level);
}

function isLevel(level) {
  return LEVELS.includes(level);
}

function shiftLevel(level, delta) {
  const currentIndex = isLevel(level) ? idx(level) : 0;
  const nextIndex = Math.max(0, Math.min(LEVELS.length - 1, currentIndex + delta));
  return LEVELS[nextIndex];
}

function normalizeLevel(level, fallback = 'novice_low') {
  return isLevel(level) ? level : fallback;
}

function sanitizeNextLevel(currentLevel, nextLevel, probeDirection) {
  if (!isLevel(nextLevel)) {
    if (probeDirection === 'up') return shiftLevel(currentLevel, 1);
    if (probeDirection === 'down') return shiftLevel(currentLevel, -1);
    return currentLevel;
  }

  const distance = Math.abs(idx(nextLevel) - idx(currentLevel));
  if (distance > 1) {
    if (probeDirection === 'up') return shiftLevel(currentLevel, 1);
    if (probeDirection === 'down') return shiftLevel(currentLevel, -1);
    return currentLevel;
  }

  return nextLevel;
}

function appendJourney(journey = [], ...levels) {
  const nextJourney = [...journey];

  levels.forEach((level) => {
    if (!isLevel(level)) return;
    if (nextJourney[nextJourney.length - 1] !== level) {
      nextJourney.push(level);
    }
  });

  return nextJourney;
}

function inferFinalLevel(state = {}) {
  if (isLevel(state.highestSustainedLevel)) return state.highestSustainedLevel;
  if (isLevel(state.breakdownLevel)) return shiftLevel(state.breakdownLevel, -1);
  return normalizeLevel(state.currentLevel, 'novice_low');
}

function inferNextTarget(state = {}, finalLevel) {
  if (isLevel(state.breakdownLevel)) return state.breakdownLevel;
  if (finalLevel === 'distinguished') return 'distinguished';
  return shiftLevel(finalLevel, 1);
}

function intakePrompt(language) {
  return `You are a warm, professional voice interviewer for the University of the Nations (UofN/YWAM) Language Proficiency Assessment.

CRITICAL: You MUST conduct this ENTIRE conversation in ${language}. Every single word you say must be in ${language}. Do NOT use English at any point, even for greetings, unless ${language} IS English.

Your task: Have a brief, friendly conversation to learn about the speaker before the formal language assessment begins. You are speaking via voice, so keep every response to 2-3 natural sentences - no bullet points, no lists.

Gather the following over 4-6 exchanges (don't rush, be conversational):
1. Their name
2. Country of origin and cultural/linguistic background
3. How long they have been using or studying ${language}
4. Why they want to use, improve, or be assessed in ${language}

Be warm and affirming. Welcome them to the University of the Nations. Do NOT ask linguistic test questions yet.

When you have gathered all four points, append exactly: [[INTAKE_COMPLETE]]

Output ONLY natural spoken text in ${language}. No markdown, no labels.`;
}

function transitionPrompt(language) {
  return `You are preparing a participant for a progressive ACTFL Oral Proficiency Interview in ${language}.

This assessment ALWAYS begins at Novice Low and then climbs one level at a time toward the highest level the speaker can sustain. You are NOT estimating a higher starting band.

Respond with ONLY raw JSON (no markdown fences, no extra text):
{"startingLevel":"novice_low","rationale":"","transitionText":""}

rationale: one short English sentence explaining that this version always starts at Novice Low and progresses upward.

transitionText: CRITICAL - write 2-3 warm, voice-friendly sentences in ${language} ONLY. Do NOT use English in transitionText unless ${language} IS English. The text must:
(a) acknowledge the speaker's background,
(b) explain that the formal assessment is starting at the novice level,
(c) explain that the interview will gradually move upward toward more advanced tasks,
(d) invite them to speak naturally and do their best.`;
}

function interviewerPrompt(language, state) {
  const {
    currentLevel = 'novice_low',
    questionsAtLevel = 0,
    totalQuestions = 0,
    highestSustainedLevel,
    breakdownLevel,
    scoringNotes = [],
  } = state;

  return `You are an ACTFL Oral Proficiency Interview (OPI) examiner conducting a ${language} proficiency assessment for a University of the Nations participant.

CRITICAL: You MUST speak ONLY in ${language} throughout this interview. Every word of "agentText" must be in ${language}. Do NOT use English unless ${language} IS English.

This version of the assessment is a progressive ladder:
- It ALWAYS begins at Novice Low.
- It climbs ONE level at a time.
- It is trying to identify the highest level the speaker can clearly sustain.
- It may drop ONE level after a breakdown to confirm the ceiling and floor.

CURRENT STATE
- Current probe level: ${currentLevel}
- Questions already asked at this level: ${questionsAtLevel}
- Total answered questions: ${totalQuestions}
- Highest sustained level so far: ${highestSustainedLevel ?? 'not yet established'}
- Breakdown level so far: ${breakdownLevel ?? 'not yet established'}
- Last 3 scoring notes: ${scoringNotes.slice(-3).join(' | ') || 'none yet'}

ACTFL CRITERIA

NOVICE (Low/Mid/High)
- Isolated words, memorized phrases, predictable communication
- Familiar topics only
- Cannot sustain paragraph-level speech

INTERMEDIATE Low
- Creates simple sentences
- Handles basic personal topics in the present
- Very limited narration or complication

INTERMEDIATE Mid
- Handles simple conversation
- Can describe familiar routines and some past/future reference
- Mostly sentence-level speech

INTERMEDIATE High
- Begins to narrate and handle complications
- Reaches toward paragraph-level speech
- Breaks down under sustained abstract demands

ADVANCED Low
- Narrates and describes in major time frames
- Produces paragraph-level discourse on familiar topics
- Handles complications with effort

ADVANCED Mid
- Sustained paragraph-level discourse
- Good control on concrete and some abstract topics
- Better organization and detail

ADVANCED High
- Discusses abstract issues with support and structure
- Strong extended discourse
- Occasional gaps near the Superior boundary

SUPERIOR
- Handles abstract, professional, and hypothetical discussion
- Organizes nuanced arguments and analysis
- Strong precision and flexibility

DISTINGUISHED
- Sophisticated rhetorical precision
- Strong register control and cultural nuance
- Approaches an educated native-speaker range

YOUR TASK
1. Evaluate the speaker's previous response against the CURRENT probe level.
2. Decide whether to move up, stay, move down, or end.
3. Ask the NEXT question at the level you want to test next.
4. Keep the whole response voice-friendly and concise.

LADDER RULES
- Use "up" when the response clearly sustains the current level and the next question should be ONE level higher.
- Use "maintain" when you need one more response at the same level.
- Use "down" when the response clearly breaks down at this level and the next question should be ONE level lower to confirm the highest sustained level.
- Use "end" when the highest sustained level is clear, or when Distinguished has been sustained, or when the interview has reached its natural end.
- NEVER skip levels. nextLevel must be either the same level, one level up, or one level down.
- If probeDirection is "end", do NOT ask another question. agentText should be a short spoken wrap-up for the interview portion.

SAMPLE TASKS BY LEVEL
- novice_low: name, origin, foods, numbers, simple preferences
- novice_mid: family, home, daily likes/dislikes
- novice_high: routines, simple present descriptions, simple needs
- intermediate_low: daily schedule, family roles, familiar places
- intermediate_mid: hometown, last weekend, simple plans
- intermediate_high: unexpected problems, short narration, simple opinions
- advanced_low: tell a detailed story, explain how a situation developed over time
- advanced_mid: work, study, or community challenges, compare approaches, explain causes and effects
- advanced_high: language and identity, education, technology, or social change with supported abstract discussion
- superior: analyze cultural complexity, public policy, leadership, or communication challenges with hypothesis and argument
- distinguished: compare competing frameworks, tailor rhetoric to different audiences, and evaluate nuanced tradeoffs

Respond with ONLY raw JSON (no markdown fences, no extra text):
{
  "agentText": "If continuing: acknowledgment plus one next question in ${language}. If ending: a short spoken wrap-up in ${language}.",
  "probeDirection": "up|maintain|down|end",
  "nextLevel": "one valid ACTFL level slug",
  "scoringNote": "Brief English note about text type, control, fluency, vocabulary, and why the next move was chosen",
  "shouldEnd": false
}`;
}

function reportPrompt(language, state, inferredFinalLevel, inferredNextTarget) {
  const rangeLabel = `Novice Low -> ${LEVEL_DISPLAY[inferredFinalLevel]}`;

  return `You are an ACTFL OPI examiner writing the final proficiency assessment report for a progressive ${language} interview conducted for University of the Nations.

This version of the interview started at Novice Low and moved upward until the highest sustainable level was identified.
The goal is to report proficiency only. Do NOT mention admissions, selection, readiness, or special placement.

INTERVIEW DATA
- All scoring notes (chronological): ${state.scoringNotes?.join(' | ') || 'none recorded'}
- Highest sustained level: ${state.highestSustainedLevel ?? inferredFinalLevel}
- Breakdown level: ${state.breakdownLevel ?? 'not clearly established'}
- Final inferred level: ${inferredFinalLevel}
- Ladder journey: ${(state.ladderJourney || []).join(' -> ') || 'novice_low'}
- Total questions answered: ${state.totalQuestions ?? 0}

Respond with ONLY raw JSON (no markdown fences, no extra text):
{
  "finalLevel": "e.g. advanced_low",
  "levelDisplay": "e.g. Advanced Low",
  "rangeLabel": "${rangeLabel}",
  "progressionSummary": "2-3 sentences summarizing how the speaker moved from Novice Low upward through the ladder",
  "summary": "2-3 sentence overview of overall performance",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "areasForGrowth": ["area 1", "area 2"],
  "nextTarget": "${inferredNextTarget}",
  "examinerNote": "1-2 sentence note describing the speaker's current proficiency and the next area to develop",
  "closingText": "Warm 2-3 sentence spoken message to the speaker: affirm their effort, explain that the interview is complete, and encourage them."
}`;
}

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

export async function POST(request) {
  try {
    const body = await request.json();
    const { phase, language, history = [], state = {}, userInput } = body;

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

    if (phase === 'transition') {
      const system = transitionPrompt(language);
      const summary = history.map((message) => `${message.role}: ${message.content}`).join('\n');
      const msgs = [{ role: 'user', content: `Intake conversation:\n${summary}` }];

      const text = await callClaude(system, msgs, 500);
      const data = safeParseJSON(text);

      return NextResponse.json({
        success: true,
        data: {
          startingLevel: 'novice_low',
          rationale: data.rationale || 'This version always starts at Novice Low and moves upward step by step.',
          transitionText: data.transitionText,
        },
      });
    }

    if (phase === 'interview') {
      const normalizedState = {
        ...state,
        currentLevel: normalizeLevel(state.currentLevel, 'novice_low'),
        highestSustainedLevel: isLevel(state.highestSustainedLevel) ? state.highestSustainedLevel : null,
        breakdownLevel: isLevel(state.breakdownLevel) ? state.breakdownLevel : null,
        scoringNotes: Array.isArray(state.scoringNotes) ? state.scoringNotes : [],
        ladderJourney: appendJourney(state.ladderJourney, normalizeLevel(state.currentLevel, 'novice_low')),
      };

      const system = interviewerPrompt(language, normalizedState);
      const msgs = !userInput
        ? [{ role: 'user', content: 'Please begin the interview with the first Novice Low question.' }]
        : [...history, { role: 'user', content: userInput }];

      const text = await callClaude(system, msgs, 700);
      const data = safeParseJSON(text);

      const newState = { ...normalizedState };

      if (userInput) {
        newState.totalQuestions = (normalizedState.totalQuestions || 0) + 1;
        if (data.scoringNote) {
          newState.scoringNotes = [...normalizedState.scoringNotes, data.scoringNote];
        }
      }

      const currentLevel = normalizedState.currentLevel;
      const probeDirection = data.probeDirection || 'maintain';
      const nextLevel = sanitizeNextLevel(currentLevel, data.nextLevel, probeDirection);

      if (!userInput) {
        newState.currentLevel = nextLevel;
        newState.ladderJourney = appendJourney(newState.ladderJourney, nextLevel);
        return NextResponse.json({ success: true, data, newState });
      }

      if (probeDirection === 'up') {
        newState.highestSustainedLevel = currentLevel;
        newState.currentLevel = nextLevel;
        newState.questionsAtLevel = 0;
      } else if (probeDirection === 'down') {
        newState.breakdownLevel = normalizedState.breakdownLevel || currentLevel;
        newState.currentLevel = nextLevel;
        newState.questionsAtLevel = 0;
      } else if (probeDirection === 'end') {
        data.shouldEnd = true;

        if (!newState.highestSustainedLevel && newState.breakdownLevel) {
          newState.highestSustainedLevel = shiftLevel(newState.breakdownLevel, -1);
        } else if (!newState.highestSustainedLevel) {
          newState.highestSustainedLevel = currentLevel;
        }
      } else {
        newState.currentLevel = nextLevel;
        newState.questionsAtLevel = (normalizedState.questionsAtLevel || 0) + 1;
      }

      if (currentLevel === 'distinguished' && probeDirection !== 'down') {
        newState.highestSustainedLevel = 'distinguished';
      }

      newState.ladderJourney = appendJourney(newState.ladderJourney, currentLevel, newState.currentLevel);

      if (newState.totalQuestions >= MAX_QUESTIONS && !data.shouldEnd) {
        data.shouldEnd = true;
        if (!newState.highestSustainedLevel) {
          newState.highestSustainedLevel = inferFinalLevel(newState);
        }
      }

      return NextResponse.json({ success: true, data, newState });
    }

    if (phase === 'report') {
      const normalizedState = {
        ...state,
        currentLevel: normalizeLevel(state.currentLevel, 'novice_low'),
        highestSustainedLevel: isLevel(state.highestSustainedLevel) ? state.highestSustainedLevel : null,
        breakdownLevel: isLevel(state.breakdownLevel) ? state.breakdownLevel : null,
        scoringNotes: Array.isArray(state.scoringNotes) ? state.scoringNotes : [],
        ladderJourney: appendJourney(state.ladderJourney, normalizeLevel(state.currentLevel, 'novice_low')),
      };

      const inferredFinalLevel = inferFinalLevel(normalizedState);
      const inferredNextTarget = inferNextTarget(normalizedState, inferredFinalLevel);
      const system = reportPrompt(language, normalizedState, inferredFinalLevel, inferredNextTarget);
      const msgs = [{ role: 'user', content: 'Generate the final assessment report.' }];

      const text = await callClaude(system, msgs, 1200);
      const data = safeParseJSON(text);

      const finalLevel = normalizeLevel(data.finalLevel, inferredFinalLevel);

      return NextResponse.json({
        success: true,
        data: {
          ...data,
          finalLevel,
          levelDisplay: data.levelDisplay || LEVEL_DISPLAY[finalLevel],
          rangeLabel: data.rangeLabel || `Novice Low -> ${LEVEL_DISPLAY[finalLevel]}`,
          nextTarget: normalizeLevel(data.nextTarget, inferredNextTarget),
          examinerNote: data.examinerNote || 'This result reflects the speaker’s current oral proficiency and their next likely stretch target on the ACTFL ladder.',
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown phase' }, { status: 400 });
  } catch (error) {
    console.error('Agent route error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
