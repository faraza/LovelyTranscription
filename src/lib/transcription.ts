import { AssemblyAI, Transcript } from 'assemblyai';
import dotenv from 'dotenv';
// import fs from 'fs';
// import path from 'path';

dotenv.config();

export async function runTranscription(file: File): Promise<Transcript> {
    const apiKey = process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY;
    if (!apiKey) {
        throw new Error('NEXT_PUBLIC_ASSEMBLYAI_API_KEY is not set');
    }

    const client = new AssemblyAI({
        apiKey: apiKey,
    });

    // Upload the file to AssemblyAI
    const uploadResponse = await client.files.upload(file);
    
    const data = {
        audio: uploadResponse,
        speaker_labels: true,
    }

    const transcript = await client.transcripts.transcribe(data);

    if (!transcript.text) {
        throw new Error('Transcript text is undefined');
    }

    return transcript;
}

export async function saveTranscript(transcript: Transcript, filepath: string) {
    console.log(transcript);
    console.log(filepath);
    //TODO: Delete this function or put it somewhere else

    // // Create directory if it doesn't exist
    // fs.mkdirSync(filepath, { recursive: true });

    // const transcriptPath = path.join(filepath, path.basename(filepath) + '.json');
    // console.log("Transcript saved to: ", transcriptPath);
    // fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));
}