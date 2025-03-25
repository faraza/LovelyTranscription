import { runTranscription } from '../src/lib/transcription';

async function main() {
    try {
        const result = await runTranscription();
        console.log('Test result:', result);
        
        // Basic assertion
        if (result !== "hello world") {
            throw new Error(`Expected "hello world" but got "${result}"`);
        }
        
        console.log('✅ Test passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

main(); 