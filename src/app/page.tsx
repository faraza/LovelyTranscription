'use client';

import { useState, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const rawTranscript = `
[0.16 - 0.62],A,What Daddy says.
[0.64 - 4.10],B,Okay let's. I'm going to fan them out so we can see them all.
[6.72 - 7.99],A,So I get to go first.
[8.10 - 9.27],C,I made it taller.
[9.42 - 10.12],A,Whoa.
[10.28 - 28.03],B,So we want to find ones. Numbers that are the same or numbers that go in a. In order in a sequence that are insane. Good. Good thoughts. No not yet. You have to have three or more.
[29.85 - 31.67],A,So it's not quite like your finish.
[31.70 - 36.03],B,So it's a start. I mean you did great. You noticed it so that was great.
[36.12 - 37.71],A,Your turn Eliza. Oh okay.
[37.84 - 39.20],C,Pick a card and discard.
[39.35 - 42.87],A,You always got to pick. You always got a discard. Don't let me see your cards.
[43.37 - 45.19],C,And I got to grab.
[48.41 - 54.00],A,I think all the glitter came out of her hair when I brushed it. It looks pretty good. Yeah sorry about that.
[54.07 - 58.73],B,Oh no like I wasn't worried it. Once the glue was gone I was like oh just brush out.
[58.76 - 59.96],A,Did the glue wash out okay?
`;

interface Segment {
  start: number;
  end: number;
  speaker: string;
  text: string;
}

function parseTranscript(raw: string): Segment[] {
  return raw
    .trim()
    .split('\n')
    .map((line) => {
      const match = line.match(/\[(.*?) - (.*?)\],(.*?),(.*)/);
      if (!match) return null;
      return {
        start: parseFloat(match[1]),
        end: parseFloat(match[2]),
        speaker: match[3],
        text: match[4].trim(),
      };
    })
    .filter((seg): seg is Segment => seg !== null);
}

export default function TranscriptPage() {
  const segments = useMemo(() => parseTranscript(rawTranscript), []);
  const uniqueSpeakers = Array.from(new Set(segments.map((s) => s.speaker)));
  const [speakerNames, setSpeakerNames] = useState(
    Object.fromEntries(uniqueSpeakers.map((s) => [s, `Speaker ${s}`]))
  );

  const audioRef = useRef<HTMLAudioElement>(null);

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

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-10">
      {/* Audio Section */}
      <section>
        <h1 className="text-2xl font-bold mb-4">Transcript Demo</h1>
        <audio ref={audioRef} controls src="/your-audio-file.mp3" className="w-full" />
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
