import { stringify } from 'csv-stringify/sync';
import { promises as fs } from 'fs';
import { GoldRow, loadGoldCSV, loadTranscript, TranscriptLine } from './csv';
import { jaccardSimilarity, permutations, preprocess } from './text';

export interface ConsolidatedGold {
    speaker: string;
    utterance: string;
}

export interface ComparisonResult {
    goldSpeaker: string;
    transcriptSpeaker: string;
    speakerCorrect: boolean;
    goldLine: string;
    matchedLine: string;
    wordsCaptured: number;
    totalGoldWords: number;
    overlapPercent: number;
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
    }

    // 2) Build permutations of transcript speakers
    const speakerPerms = permutations(transSpeakers);

    let bestMap: Record<string, string> = {};
    let bestScore = -Infinity;

    for (const perm of speakerPerms) {
        // create a map: goldSpeakers[i] -> perm[i]
        const candidateMapping: Record<string, string> = {};
        for (let i = 0; i < goldSpeakers.length && i < perm.length; i++) {
            candidateMapping[goldSpeakers[i]] = perm[i];
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

    // 5) Find best speaker mapping (e.g. "1->A, 2->B, 3->C") by trying permutations
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