import { NextResponse } from 'next/server';

// Map language IDs to environment variable voice IDs.
// All default to the same voice — ElevenLabs eleven_multilingual_v2
// handles any language with a single voice ID.
const VOICE_ENV = {
  english:    'ELEVENLABS_VOICE_EN',
  spanish:    'ELEVENLABS_VOICE_ES',
  portuguese: 'ELEVENLABS_VOICE_PT',
  french:     'ELEVENLABS_VOICE_FR',
  korean:     'ELEVENLABS_VOICE_KO',
  chinese:    'ELEVENLABS_VOICE_ZH',
  arabic:     'ELEVENLABS_VOICE_AR',
  hindi:      'ELEVENLABS_VOICE_HI',
  german:     'ELEVENLABS_VOICE_DE',
  japanese:   'ELEVENLABS_VOICE_JA',
};

const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM'; // ElevenLabs "Rachel"

export async function POST(request) {
  try {
    const { text, language = 'english' } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // If no ElevenLabs key, signal the client to use browser TTS fallback
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ useFallback: true });
    }

    const envKey = VOICE_ENV[language] ?? 'ELEVENLABS_VOICE_EN';
    const voiceId = process.env[envKey] || DEFAULT_VOICE;

    const elevenResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.substring(0, 2500), // ElevenLabs character limit per request
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.78,
            style: 0.18,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elevenResp.ok) {
      const errText = await elevenResp.text();
      console.error('ElevenLabs API error:', elevenResp.status, errText);
      return NextResponse.json({ useFallback: true });
    }

    const audioBuffer = await elevenResp.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('TTS route error:', error);
    return NextResponse.json({ useFallback: true });
  }
}
