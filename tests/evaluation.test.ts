import path from 'path';
import { writeTranscriptToCSV, getAsString, exampleCompare, convertAzureDiarizationToCSV } from '@/lib/evaluation/index';
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

async function convertAzureDiarizationToCSVTest() {
    const azurePath = path.join(__dirname, 'assets/csv/azure_diarization.csv');
    await convertAzureDiarizationToCSV(azurePath);    
}

async function compareToGoldStandardTest() {
    const goldStandardPath = path.join(__dirname, 'assets/csv/goldStandard.csv');
    const transcriptPath = path.join(__dirname, 'assets/csv/sample1.csv');
    const outputPath = path.join(__dirname, 'assets/csv/sample1_evaluation.csv');

    // const transcriptPath = path.join(__dirname, 'assets/csv/azure_diarization_converted.csv');
    // const outputPath = path.join(__dirname, 'assets/csv/azure_diarization_evaluation.csv');

    await exampleCompare(goldStandardPath, transcriptPath, outputPath);        
}

// writeTranscriptToCSVTest();

compareToGoldStandardTest();

// convertAzureDiarizationToCSVTest();
