'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { runTranscription } from '@/lib/transcription';
import { uploadStore } from '@/lib/uploadStore';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    startProcessing(e.target.files[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      startProcessing(e.dataTransfer.files[0]);
    }
  };

  const startProcessing = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setLoading(true);
    
    try {
      // Store the file in our upload store
      uploadStore.set(uploadedFile);
      
      // Run transcription
      const transcript = await runTranscription(uploadedFile);
      
      // Store just the transcript data in localStorage
      localStorage.setItem('currentTranscript', JSON.stringify(transcript));
      
      // Navigate to transcript page
      router.push('/transcriptPage');
    } catch (error) {
      console.error('Transcription failed:', error);
      alert('Failed to transcribe the audio file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Upload an Audio File</h1>

      <div
        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded p-8 text-center cursor-pointer hover:border-gray-400"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <p className="text-gray-600 mb-3">Drag & Drop your audio file here</p>
        <p className="text-sm text-gray-500 mb-2">— or —</p>
        <label className="cursor-pointer text-blue-600 underline">
          Select a file
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {file && (
        <p className="text-gray-700 text-sm">
          Selected File: <span className="font-medium">{file.name}</span>
        </p>
      )}

      {loading && (
        <div className="mt-4">
          <p className="text-gray-700">Processing your audio...</p>
          <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden mt-2">
            <div className="absolute inset-0 bg-blue-500 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
