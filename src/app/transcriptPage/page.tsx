'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Transcript } from 'assemblyai';
import { uploadStore } from '@/lib/uploadStore';

interface Segment {
  start: number;
  end: number;
  speaker: string;
  text: string;
}

function parseTranscript(transcript: Transcript): Segment[] {
  if (!transcript.utterances) return [];
  
  return transcript.utterances.map(utterance => ({
    start: Number((utterance.start / 1000).toFixed(2)),
    end: Number((utterance.end / 1000).toFixed(2)),
    speaker: utterance.speaker || 'Unknown',
    text: utterance.text || '',
  }));
}

export default function TranscriptPage() {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const segments = useMemo(() => transcript ? parseTranscript(transcript) : [], [transcript]);
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});

useEffect(() => {
  const speakers = Array.from(new Set(segments.map((s) => s.speaker)));
  setSpeakerNames((prev) => {
    const updated = { ...prev };
    for (const s of speakers) {
      if (!updated[s]) updated[s] = `Speaker ${s}`;
    }
    return updated;
  });
}, [segments]);

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const savedTranscript = localStorage.getItem('currentTranscript');
    if (savedTranscript) {
      const parsedTranscript = JSON.parse(savedTranscript);
      
      // Get the file from our upload store
      const audioFile = uploadStore.get();
      if (audioFile) {
        // Create a new object URL for the audio file
        const url = URL.createObjectURL(audioFile);
        setAudioUrl(url);
        setTranscript({
          ...parsedTranscript,
          audio_url: url
        });
      } else {
        setTranscript(parsedTranscript);
      }
    }

    // Cleanup function
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      uploadStore.clear();
    };
  }, []);

  const handleNameChange = (id: string, name: string) => {
    setSpeakerNames((prev) => ({ ...prev, [id]: name }));
  };

  const playSegment = (start: number, end: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = start;
    audio.play();

    const stopAt = () => {
      if (audio.currentTime >= end) {
        audio.pause();
        audio.removeEventListener('timeupdate', stopAt);
      }
    };

    audio.addEventListener('timeupdate', stopAt);
  };

  if (!transcript) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">No transcript available</h1>
        <p className="mt-4">Please upload an audio file first.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-10">
      {/* Audio Section */}
      <section>
        <h1 className="text-2xl font-bold mb-4">Transcript</h1>
        <audio ref={audioRef} controls src={audioUrl || ''} className="w-full" />
      </section>

      {/* Speaker Names Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Speakers</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(speakerNames).map(([id, name]) => (
            <div key={id} className="flex items-center gap-2">
              <label className="text-sm w-12 font-medium text-gray-700">{id}:</label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(id, e.target.value)}
                className="flex-1"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Transcript Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Transcript</h2>
        <ul className="space-y-4">
          {segments.map((seg, idx) => (
            <li key={idx} className="border p-4 rounded-lg shadow space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                  <span className="font-medium text-gray-700">
                    {speakerNames[seg.speaker]}
                  </span>{' '}
                  ({seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s)
                </span>
                <Button size="sm" onClick={() => playSegment(seg.start, seg.end)}>
                  ▶ Play
                </Button>
              </div>
              <p className="text-gray-800">{seg.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
} 