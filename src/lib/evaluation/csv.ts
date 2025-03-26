import { Transcript } from "assemblyai";
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { promises as fs } from 'fs';
import path from "path";

/**
 * Writes a transcript to a CSV file.
 * Format:
 * Timestamp: [start - end] (in seconds; this assumes the transcript is in milliseconds)
 * Speaker: A, B, etc.
 * Utterance: full spoken text
 * 
 * @param transcript The transcript object from AssemblyAI (containing `utterances`)
 * @param filepath Path to the CSV file to create or overwrite
 */
export async function writeTranscriptToCSV(
    transcript: Transcript,
    filepath: string
): Promise<void> {
    if (!transcript.utterances) {
        throw new Error('Transcript does not contain utterances');
    }

    const header = ['Timestamp', 'Speaker', 'Utterance'];

    const rows = transcript.utterances.map((utt) => {
        const startSec = (utt.start / 1000).toFixed(2);
        const endSec = (utt.end / 1000).toFixed(2);
        const timestamp = `[${startSec} - ${endSec}]`;
        const speaker = utt.speaker;
        const utterance = (utt.text || '')
            .replace(/\r?\n|\r/g, ' ')  // Remove newlines
            .replace(/"/g, '')          // Remove quotes
            .replace(/,/g, '');         // Remove commas
        return [timestamp, speaker, utterance];
    });

    const csvLines = [
        header.join(','),
        ...rows.map((row) => {
            // Handle timestamp and speaker normally, but leave utterance unescaped
            return [
                escapeCSV(row[0]), // timestamp
                escapeCSV(row[1]), // speaker
                row[2]  // utterance - no escaping
            ].join(',');
        })
    ];

    await fs.writeFile(filepath, csvLines.join('\n'), 'utf-8');
}

/**
 * Escapes CSV-special characters like quotes, commas, or newlines.
 */
export function escapeCSV(value: string): string {
    if (value == null) return '';
    if (/[",\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

export interface GoldRow {
    Speaker: string;   // e.g. "1", "2", "3"
    Utterance: string;
    Code: string;      // optional
}

export interface TranscriptRow {
    Timestamp: string;   // e.g. "[0.16 - 0.62]"
    Speaker: string;     // e.g. "A", "B", "C"
    Utterance: string;
}

export async function loadGoldCSV(csvPath: string): Promise<GoldRow[]> {
    const raw = await fs.readFile(path.resolve(csvPath), 'utf-8');
    const records = parse(raw, { columns: true, skip_empty_lines: true }) as GoldRow[];
    // trim
    for (const r of records) {
        r.Speaker = r.Speaker.trim();
        r.Utterance = r.Utterance.trim();
    }
    return records;
}

export async function loadTranscript(csvPath: string): Promise<TranscriptLine[]> {
    const raw = await fs.readFile(path.resolve(csvPath), 'utf-8');
    const records = parse(raw, { columns: true, skip_empty_lines: true }) as TranscriptRow[];

    const lines: TranscriptLine[] = [];
    for (const r of records) {
        const spk = (r.Speaker || '').trim();
        const utt = (r.Utterance || '').trim();
        if (spk && utt) {
            lines.push({ speaker: spk, utterance: utt });
        }
    }
    return lines;
}

export interface TranscriptLine {
    speaker: string;
    utterance: string;
} 