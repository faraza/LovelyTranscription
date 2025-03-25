import { Transcript } from "assemblyai";

/**
 * Takes in transcript and returns string Speaker: Utterance (new line)
 */
export async function getAsString(transcript: Transcript): Promise<string> {
    if (!transcript.utterances) {
        throw new Error('Transcript does not contain utterances');
    }
    return transcript.utterances.map((utt) => `${utt.speaker}: ${utt.text}`).join('\n');
} 