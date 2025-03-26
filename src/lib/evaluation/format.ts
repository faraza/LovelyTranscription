import { Transcript } from "assemblyai";
import { escapeCSV } from "./csv";

/**
 * Takes in transcript and returns string Speaker: Utterance (new line)
 */
export async function getAsString(transcript: Transcript): Promise<string> {
    if (!transcript.utterances) {
        throw new Error('Transcript does not contain utterances');
    }
    return transcript.utterances.map((utt) => `${utt.speaker}: ${utt.text}`).join('\n');
} 


import { promises as fs } from 'fs';
import * as path from 'path';

export async function convertAzureDiarizationToCSV(azurePath: string): Promise<string> {
  const fileContent = await fs.readFile(azurePath, 'utf-8');
  const lines = fileContent.trim().split(/\r?\n/);

  const header = lines.shift(); // Remove header line
  if (!header?.startsWith('Timestamp,Transcript')) {
    throw new Error('Invalid Azure CSV format: Missing expected header.');
  }

  const entries: {
    startTime: number;
    speakerRaw: string;
    text: string;
  }[] = [];

  // Parse all lines
  for (const line of lines) {
    const commaIndex = line.indexOf(',');
    const left = line.slice(0, commaIndex).trim(); // e.g. "Speaker 1 00:00"
    const right = line.slice(commaIndex + 1).trim().replace(/^"|"$/g, ''); // Transcript without quotes

    const match = left.match(/Speaker (\d+) (\d{2}):(\d{2})/);
    if (!match) continue;

    const speakerNumber = match[1];
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const timeInSeconds = +(minutes * 60 + seconds).toFixed(2);

    entries.push({
      startTime: timeInSeconds,
      speakerRaw: speakerNumber,
      text: right
    });
  }

  // Estimate end times and normalize speaker IDs to A, B, C...
  const speakerMap = new Map<string, string>();
  let nextSpeakerId = 0;

  function getSpeakerLetter(speakerNum: string): string {
    if (!speakerMap.has(speakerNum)) {
      const letter = String.fromCharCode(65 + nextSpeakerId); // A, B, C, ...
      speakerMap.set(speakerNum, letter);
      nextSpeakerId++;
    }
    return speakerMap.get(speakerNum)!;
  }

  const rows: string[] = ['Timestamp,Speaker,Utterance'];

  for (let i = 0; i < entries.length; i++) {
    const curr = entries[i];
    const next = entries[i + 1];
    const start = curr.startTime;
    const end = next ? next.startTime : +(start + 2.0).toFixed(2); // assume 2s if last entry

    const timestamp = `[${start.toFixed(2)} - ${end.toFixed(2)}]`;
    const speaker = getSpeakerLetter(curr.speakerRaw);
    const utterance = curr.text.replace(/\s+/g, ' ').trim();

    rows.push(`${timestamp},${speaker},${escapeCSV(utterance)}`);
  }

  const result = rows.join('\n');
  const outPath = path.join(path.dirname(azurePath), 'converted_transcript.csv');
  await fs.writeFile(outPath, result, 'utf-8');

  return outPath;
}
