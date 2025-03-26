// app/api/transcribe/route.ts
import { AssemblyAI } from 'assemblyai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { fileUrl } = await req.json();

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key missing' }, { status: 500 });
  }

  const client = new AssemblyAI({ apiKey });

  try {
    const transcript = await client.transcripts.transcribe({
      audio: fileUrl,
      speaker_labels: true,
    });

    if (!transcript.text) {
      throw new Error('Transcript failed');
    }

    console.log(transcript);

    return NextResponse.json(transcript);
  } catch (error) {
    console.error('Transcription failed:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
