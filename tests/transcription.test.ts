import path from 'path';
import { runTranscription, saveTranscript } from '@/lib/transcription';

async function transcribeSample1() {
    const filepath = path.join(__dirname, 'assets/sample1.wav') 
    const result = await runTranscription(filepath)    
    saveTranscript(result, path.join(__dirname, 'assets/transcripts'))
}


transcribeSample1()
