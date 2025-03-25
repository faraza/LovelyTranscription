import path from 'path';
import { writeTranscriptToCSV, getAsString, exampleCompare } from '@/lib/evaluation';
import fs from 'fs';
import { Transcript } from 'assemblyai';

async function writeTranscriptToCSVTest() {
    const samplePath = path.join(__dirname, 'assets/transcripts/sample1.json');
    const transcript = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    
    const outputPath = path.join(__dirname, 'assets/csv/sample1.csv');
    const csvDir = path.dirname(outputPath);
    if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true });
    }
    await writeTranscriptToCSV(transcript, outputPath);
}

async function getAsStringTest() {
    const samplePath = path.join(__dirname, 'assets/transcripts/sample1.json');
    const transcript = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    const result = await getAsString(transcript);
    console.log(result);
}

async function compareToGoldStandardTest() {
    const goldStandardPath = path.join(__dirname, 'assets/csv/goldStandard.csv');
    const transcriptPath = path.join(__dirname, 'assets/csv/sample1.csv');
    const outputPath = path.join(__dirname, 'assets/csv/sample1_evaluation.csv');
    await exampleCompare(goldStandardPath, transcriptPath, outputPath);        
}

// writeTranscriptToCSVTest();

compareToGoldStandardTest();
