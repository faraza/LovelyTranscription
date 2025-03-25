import { AssemblyAI, Transcript } from 'assemblyai';
import dotenv from 'dotenv';

dotenv.config();

export async function runTranscription(filepath: string): Promise<Transcript> {
    const apiKey = process.env.ASSEMBLYAI_API_KEY
    if (!apiKey) {
        throw new Error('ASSEMBLYAI_API_KEY is not set');
    }

    const client = new AssemblyAI({
        apiKey: apiKey,
    });

    const FILE_URL = filepath;    
    
    const data = {
        audio: FILE_URL,
        speaker_labels: true,
    }

    const transcript = await client.transcripts.transcribe(data);

    if (!transcript.text) {
        throw new Error('Transcript text is undefined');
    }

    return transcript;
} 

export async function saveTranscript(transcript: Transcript, filepath: string) {
    const fs = require('fs');
    const path = require('path');

    // Create directory if it doesn't exist
    fs.mkdirSync(filepath, { recursive: true });

    const transcriptPath = path.join(filepath, path.basename(filepath) + '.json');
    console.log("Transcript saved to: ", transcriptPath);
    fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));
}