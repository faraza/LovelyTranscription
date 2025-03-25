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
function escapeCSV(value: string): string {
    if (value == null) return '';
    if (/[",\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

//takes in transcript and returns string Speaker: Utterance (new line)
export async function getAsString(transcript: Transcript) {
    if (!transcript.utterances) {
        throw new Error('Transcript does not contain utterances');
    }
    return transcript.utterances.map((utt) => `${utt.speaker}: ${utt.text}`).join('\n');
}

interface GoldRow {
    Speaker: string;   // e.g. "1", "2", "3"
    Utterance: string;
    Code: string;      // optional
  }
  
  interface TranscriptRow {
    Timestamp: string;   // e.g. "[0.16 - 0.62]"
    Speaker: string;     // e.g. "A", "B", "C"
    Utterance: string;
  }
  
  interface ConsolidatedGold {
    speaker: string;
    utterance: string;
  }
  
  interface TranscriptLine {
    speaker: string;
    utterance: string;
  }
  
  interface ComparisonResult {
    goldSpeaker: string;
    transcriptSpeaker: string;
    speakerCorrect: boolean;
    goldLine: string;
    matchedLine: string;
    wordsCaptured: number;
    totalGoldWords: number;
    overlapPercent: number;
  }
  
  export async function exampleCompare(
    goldCSVPath: string,
    transcriptPath: string,
    outputPath: string
  ): Promise<void> {
    // 1) Load gold CSV
    const goldRows = await loadGoldCSV(goldCSVPath);
  
    // 2) Consolidate consecutive gold lines (same speaker => merge)
    const consolidatedGold = consolidateGold(goldRows);
    console.log(`Consolidated gold lines: ${consolidatedGold.length}`);
  
    // 3) Load transcript CSV
    const transcriptLines = await loadTranscript(transcriptPath);
  
    // 4) Group transcript lines by their speaker (A,B,C,...)
      const transcriptBySpeaker = groupTranscriptBySpeaker(transcriptLines);
  
    // 5) Find best speaker mapping (e.g. “1->A, 2->B, 3->C”) by trying permutations
    const bestMapping = findBestSpeakerMapping(consolidatedGold, transcriptBySpeaker);
    console.log('Best speaker mapping found:', bestMapping);
  
    // 6) For each gold line, pick the single best transcript line from the mapped speaker
    const results: ComparisonResult[] = [];
    for (const gold of consolidatedGold) {
      const goldSpk = gold.speaker;
      const mappedSpk = bestMapping[goldSpk] || ''; // e.g. if "2" => "A"
  
      // We'll consider lines from that transcript speaker
      const possibleLines = transcriptBySpeaker[mappedSpk] || [];
  
      if (possibleLines.length === 0) {
        // no lines at all for that speaker => no overlap
        const goldTokens = preprocess(gold.utterance);
        results.push({
          goldSpeaker: goldSpk,
          transcriptSpeaker: mappedSpk,
          speakerCorrect: false,
          goldLine: gold.utterance,
          matchedLine: '',
          wordsCaptured: 0,
          totalGoldWords: goldTokens.length,
          overlapPercent: 0
        });
        continue;
      }
  
      // pick the transcript line with highest similarity to gold.utterance
      let bestSim = 0;
      let bestLine = '';
      for (const tLine of possibleLines) {
        const sim = jaccardSimilarity(gold.utterance, tLine.utterance);
        if (sim > bestSim) {
          bestSim = sim;
          bestLine = tLine.utterance;
        }
      }
  
      // speakerCorrect => whether this mapped speaker matches bestMapping
      // (We assume if bestMapping[goldSpk] == mappedSpk, that is correct.)
      const speakerCorrect = mappedSpk.trim() !== '';
  
      // measure how many gold words appear in the best matched line
      const goldTokens = preprocess(gold.utterance);
      const bestTokens = preprocess(bestLine);
      const overlapCount = goldTokens.filter(g => bestTokens.includes(g)).length;
      const overlapPercent = goldTokens.length
        ? Math.round((overlapCount / goldTokens.length) * 100)
        : 0;
  
      results.push({
        goldSpeaker: goldSpk,
        transcriptSpeaker: mappedSpk,
        speakerCorrect,
        goldLine: gold.utterance,
        matchedLine: bestLine,
        wordsCaptured: overlapCount,
        totalGoldWords: goldTokens.length,
        overlapPercent
      });
    }
  
    // 7) Write results to CSV
    const csvOut = stringify(results, {
      header: true,
      columns: [
        { key: 'goldSpeaker', header: 'Gold Speaker' },
        { key: 'transcriptSpeaker', header: 'Transcript Speaker' },
        { key: 'speakerCorrect', header: 'Speaker Correct?' },
        { key: 'goldLine', header: 'Gold Line' },
        { key: 'matchedLine', header: 'Matched Transcript Line' },
        { key: 'wordsCaptured', header: 'Words Captured' },
        { key: 'totalGoldWords', header: 'Total Gold Words' },
        { key: 'overlapPercent', header: 'Overlap %' },
      ]
    });
  
    await fs.writeFile(outputPath, csvOut, 'utf-8');
    console.log(`Wrote comparison CSV to ${outputPath}`);
  }
  
  // ----------------------------------------------------------------------
  //  Utility Functions
  // ----------------------------------------------------------------------
  
  async function loadGoldCSV(csvPath: string): Promise<GoldRow[]> {
    const raw = await fs.readFile(path.resolve(csvPath), 'utf-8');
    const records = parse(raw, { columns: true, skip_empty_lines: true }) as GoldRow[];
    // trim
    for (const r of records) {
      r.Speaker = r.Speaker.trim();
      r.Utterance = r.Utterance.trim();
    }
    return records;
  }
  
  /**
   * Merges consecutive lines where the Speaker is the same,
   * concatenating their utterances into one.
   */
  function consolidateGold(goldRows: GoldRow[]): ConsolidatedGold[] {
    if (goldRows.length === 0) return [];
  
    const result: ConsolidatedGold[] = [];
    let current = {
      speaker: goldRows[0].Speaker,
      utterance: goldRows[0].Utterance
    };
  
    for (let i = 1; i < goldRows.length; i++) {
      const row = goldRows[i];
      if (row.Speaker === current.speaker) {
        // same speaker => merge text
        current.utterance += ' ' + row.Utterance;
      } else {
        // push the old chunk, reset
        result.push({ ...current });
        current = { speaker: row.Speaker, utterance: row.Utterance };
      }
    }
    // push final
    result.push(current);
  
    return result;
  }
  
  /**
   * Loads transcript from CSV with columns: Timestamp, Speaker, Utterance
   * We'll only keep speaker + utterance.
   */
  async function loadTranscript(csvPath: string): Promise<TranscriptLine[]> {
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
  
  /**
   * Returns a dictionary keyed by speaker letter, e.g. { "A": [ lines ], "B": [ lines ], ... }
   */
  function groupTranscriptBySpeaker(lines: TranscriptLine[]): Record<string, TranscriptLine[]> {
    const dict: Record<string, TranscriptLine[]> = {};
    for (const line of lines) {
      if (!dict[line.speaker]) dict[line.speaker] = [];
      dict[line.speaker].push(line);
    }
    return dict;
  }
  
  /**
   * Attempt all permutations of transcript speaker labels to map gold speakers -> transcript speakers.
   * Then pick the mapping that yields the highest total similarity across all lines.
   */
  function findBestSpeakerMapping(
    consolidatedGold: ConsolidatedGold[],
    transcriptBySpeaker: Record<string, TranscriptLine[]>
  ): Record<string, string> {
    // 1) Identify unique gold speakers and transcript speakers
    const goldSpeakers = Array.from(new Set(consolidatedGold.map(g => g.speaker)));
    const transSpeakers = Object.keys(transcriptBySpeaker);
  
    // If they differ in length, we do a partial approach or just bail
    if (goldSpeakers.length !== transSpeakers.length) {
      console.warn(
        'Warning: different # of gold vs. transcript speakers. Using partial matching logic.'
      );
      // If you want a full approach, you'd do a bipartite matching or some partial permutations.
    }
  
    // 2) Build permutations of transcript speakers
    const speakerPerms = permutations(transSpeakers);
  
    let bestMap: Record<string, string> = {};
    let bestScore = -Infinity;
  
    for (const perm of speakerPerms) {
      // create a map: goldSpeakers[i] -> perm[i]
      const candidateMapping: Record<string, string> = {};
      for (let i = 0; i < goldSpeakers.length && i < perm.length; i++) {
        candidateMapping[ goldSpeakers[i] ] = perm[i];
      }
      // compute total similarity for that mapping
      const score = computeGlobalSimilarity(consolidatedGold, candidateMapping, transcriptBySpeaker);
      if (score > bestScore) {
        bestScore = score;
        bestMap = candidateMapping;
      }
    }
    return bestMap;
  }
  
  /**
   * For each gold line, we find the transcript speaker from the map,
   * then pick the best line from that speaker. Sum up all Jaccard similarities.
   */
  function computeGlobalSimilarity(
    consolidatedGold: ConsolidatedGold[],
    mapping: Record<string, string>,
    transcriptBySpeaker: Record<string, TranscriptLine[]>
  ): number {
    let total = 0;
    for (const gold of consolidatedGold) {
      const goldSpk = gold.speaker;
      const mappedSpk = mapping[goldSpk] || '';
      const lines = transcriptBySpeaker[mappedSpk] || [];
      let bestSim = 0;
      for (const t of lines) {
        const sim = jaccardSimilarity(gold.utterance, t.utterance);
        if (sim > bestSim) {
          bestSim = sim;
        }
      }
      total += bestSim;
    }
    return total;
  }
  
  /**
   * Generate all permutations of a string array (simple approach).
   */
  function permutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i];
      const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permutations(remaining)) {
        result.push([current, ...perm]);
      }
    }
    return result;
  }
  
  /** Remove punctuation, toLowerCase, split. */
  function preprocess(str: string): string[] {
    return str
      .replace(/[.,!?;:'"]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }
  
  /** Jaccard overlap of two strings => float in [0..1]. */
  function jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(preprocess(a));
    const setB = new Set(preprocess(b));
    if (setA.size === 0 && setB.size === 0) return 1;
    const intersect = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersect.size / union.size;
  }