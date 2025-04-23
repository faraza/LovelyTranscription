'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Play, Pause, User, Clock, MessageSquare, RotateCcw, Download } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { Transcript } from 'assemblyai';
import { uploadStore } from '@/lib/uploadStore';
import { useRouter } from 'next/navigation';
import { Switch } from "@/components/ui/switch";

interface Segment {
  start: number;
  end: number;
  speaker: string;
  text: string;
  confidence: number;
}

interface SpeakerInfo {
  name: string;
  isChild: boolean;
}

function parseTranscript(transcript: Transcript): Segment[] {
  if (!transcript.utterances) return [];

  return transcript.utterances.map(utterance => ({
    start: Number((utterance.start / 1000).toFixed(2)),
    end: Number((utterance.end / 1000).toFixed(2)),
    speaker: utterance.speaker || 'Unknown',
    text: utterance.text || '',
    confidence: utterance.confidence || 0,
  }));
}

import clsx from "clsx";   // if you don't have clsx, `npm i clsx`

const toggleClasses = (isChild: boolean) =>
  clsx(
    "relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full transition-colors",
    "border border-border focus:outline-none focus:ring-2 focus:ring-offset-2",
    isChild
      ? "bg-rose-600 dark:bg-rose-400 focus:ring-rose-600/70"
      : "bg-zinc-300 dark:bg-zinc-700 focus:ring-zinc-500/70"
  );

const thumbClasses = (isChild: boolean) =>
  clsx(
    "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition-all",
    isChild ? "translate-x-8" : "translate-x-1"
  );

export default function TranscriptPage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const segments = useMemo(() => transcript ? parseTranscript(transcript) : [], [transcript]);
  const [speakerNames, setSpeakerNames] = useState<Record<string, SpeakerInfo>>({});
  const [currentSegment, setCurrentSegment] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const speakers = Array.from(new Set(segments.map((s) => s.speaker)));
    setSpeakerNames((prev) => {
      const updated = { ...prev };
      for (const s of speakers) {
        if (!updated[s]) updated[s] = { name: `Speaker ${s}`, isChild: false };
      }
      return updated;
    });
  }, [segments]);

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

  // Set up audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentSegment(null);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const handleNameChange = (id: string, name: string) => {
    setSpeakerNames((prev) => ({
      ...prev,
      [id]: { ...prev[id], name }
    }));
  };

  const handleToggleChange = (id: string, isChild: boolean) => {
    setSpeakerNames((prev) => ({
      ...prev,
      [id]: { ...prev[id], isChild }
    }));
  };

  const getSpeakerColor = (speakerId: string) => {
    const colors = [
      "bg-blue-100 text-blue-800 border-blue-200",
      "bg-green-100 text-green-800 border-green-200",
      "bg-purple-100 text-purple-800 border-purple-200",
      "bg-amber-100 text-amber-800 border-amber-200",
      "bg-rose-100 text-rose-800 border-rose-200",
    ];
    const charCode = speakerId.charCodeAt(0);
    return colors[charCode % colors.length];
  };

  const getAvatarColor = (speakerId: string) => {
    const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-rose-500"];
    const charCode = speakerId.charCodeAt(0);
    return colors[charCode % colors.length];
  };

  const playSegment = (index: number, start: number, end: number) => {
    if (audioRef.current) {
      // If already playing this segment, pause it
      if (currentSegment === index && isPlaying) {
        audioRef.current.pause();
        setCurrentSegment(null);
        return;
      }

      setCurrentSegment(index);
      audioRef.current.currentTime = start;
      audioRef.current.play();

      // Stop playback when segment ends
      const stopPlayback = () => {
        if (audioRef.current && audioRef.current.currentTime >= end) {
          audioRef.current.pause();
          setCurrentSegment(null);
          audioRef.current.removeEventListener('timeupdate', stopPlayback);
        }
      };

      audioRef.current.addEventListener('timeupdate', stopPlayback);
    }
  };

  const handleStartOver = () => {
    // Clear the transcript from localStorage
    localStorage.removeItem('currentTranscript');
    // Clear the audio file from upload store
    uploadStore.clear();
    // Revoke the audio URL if it exists
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    // Redirect to home page
    router.push('/');
  };

  const handleDownloadCSV = () => {
    if (!transcript) return;

    // Create CSV content
    const csvContent = [
      ['Speaker', 'Adult/Child', 'Timing', 'Utterance', 'Confidence'], // Header row
      ...segments.map(segment => [
        speakerNames[segment.speaker]?.name || `Speaker ${segment.speaker}`,
        speakerNames[segment.speaker]?.isChild ? 'Child' : 'Adult',
        `${formatTime(segment.start)} - ${formatTime(segment.end)}`,
        segment.text,
        (segment.confidence * 100).toFixed(1) + '%'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'transcript.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!transcript) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-background to-muted">
        <div className="text-center max-w-md mx-auto p-8 rounded-lg border shadow-lg bg-card">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-4">No transcript available</h1>
          <p className="text-muted-foreground mb-6">Please upload an audio file to generate a transcript.</p>
          <Button size="lg" className="px-8">
            Upload Audio File
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-16">
      <div className="container mx-auto py-8 px-4">
        <header className="mb-10 text-center">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-4xl font-bold">Transcript Review</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadCSV}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
              <Button
                variant="outline"
                onClick={handleStartOver}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Start Over
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">Review and edit your audio transcript</p>
        </header>

        {/* Audio Player */}
        <div className="mb-12 max-w-3xl mx-auto">
          <div className="bg-card rounded-lg shadow-lg p-6 border">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-primary/10 p-2 rounded-full mr-2">
                <Play className="h-5 w-5 text-primary" />
              </span>
              Audio Player
            </h2>
            <audio ref={audioRef} controls className="w-full rounded-md" src={audioUrl || undefined}>
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Speaker Management */}
          <div className="md:col-span-1">
            <div className="bg-card rounded-lg shadow-lg p-6 border sticky top-4">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="bg-primary/10 p-2 rounded-full mr-2">
                  <User className="h-5 w-5 text-primary" />
                </span>
                Speakers
              </h2>

              <div className="space-y-4">
                {Object.entries(speakerNames).map(([speakerId, speakerInfo]) => (
                  <div key={speakerId} className="space-y-2">
                    {/* Avatar + ID badge */}
                    <div className="flex items-center gap-2">
                      <Avatar className={`h-8 w-8 ${getAvatarColor(speakerId)}`}>
                        <AvatarFallback>{speakerId}</AvatarFallback>
                      </Avatar>
                      <Badge variant="outline" className={`${getSpeakerColor(speakerId)} border`}>
                        ID: {speakerId}
                      </Badge>
                    </div>

                    {/* Name input */}
                    <Input
                      value={speakerInfo.name}
                      onChange={(e) => handleNameChange(speakerId, e.target.value)}
                      className="w-full mb-2"
                      placeholder="Speaker name"
                    />

                    {/* ← Replace your old toggle here with this */}
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                      <label
                        htmlFor={`speaker-${speakerId}-toggle`}
                        className="text-sm font-medium"
                      >
                        {speakerInfo.isChild ? 'Child Speaker' : 'Adult Speaker'}
                      </label>
                      <Switch
                        id={`speaker-${speakerId}-toggle`}
                        checked={speakerInfo.isChild}
                        onCheckedChange={(checked) =>
                          handleToggleChange(speakerId, checked)
                        }
                        className="
                relative inline-flex h-6 w-12 shrink-0 cursor-pointer
                rounded-full border-2 border-transparent
                transition-colors duration-200 ease-in-out
                bg-gray-300
                data-[state=checked]:bg-primary
                focus:outline-none focus:ring-2 focus:ring-primary
                focus:ring-offset-2
              "
                      >
                        <span className="sr-only">Speaker type</span>
                        <span
                          aria-hidden="true"
                          className="
                  pointer-events-none inline-block h-5 w-5 transform
                  rounded-full bg-white shadow ring-0
                  transition duration-200 ease-in-out
                  data-[state=checked]:translate-x-6
                "
                        />
                      </Switch>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Transcript Display */}
          <div className="md:col-span-2">
            <div className="bg-card rounded-lg shadow-lg p-6 border mb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="bg-primary/10 p-2 rounded-full mr-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </span>
                Transcript
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Click on any segment to play the corresponding audio. Edit speaker names in the panel to the left.
              </p>
            </div>

            <div className="space-y-4">
              {segments.map((segment, index) => (
                <Card
                  key={index}
                  className={`transition-all duration-200 hover:shadow-md ${currentSegment === index ? "ring-2 ring-primary shadow-lg" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Avatar className={`h-8 w-8 ${getAvatarColor(segment.speaker)}`}>
                          <AvatarFallback>{segment.speaker}</AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium">
                            {speakerNames[segment.speaker]?.name || `Speaker ${segment.speaker}`}
                          </span>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>
                              {formatTime(segment.start)} - {formatTime(segment.end)}
                            </span>
                            <span className="mx-2">•</span>
                            <span className="text-xs">
                              Confidence: {(segment.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={currentSegment === index && isPlaying ? "default" : "outline"}
                        onClick={() => playSegment(index, segment.start, segment.end)}
                        className="flex items-center gap-1 h-8"
                      >
                        {currentSegment === index && isPlaying ? (
                          <>
                            <Pause className="h-3 w-3" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" />
                            <span>Play</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="pl-10">
                      <p className="text-sm leading-relaxed">{segment.text}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 