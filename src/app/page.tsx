'use client';

import { useState, useRef, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { Upload, X, Music, Loader2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { runTranscription } from '@/lib/transcription';
import { uploadStore } from '@/lib/uploadStore';

export default function UploadPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("audio/"));
    if (droppedFiles.length > 0) {
      setFile(droppedFiles[0]);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type.startsWith("audio/")) {
        setFile(selectedFile);
      }
    }
  }, []);

  const removeFile = useCallback(() => {
    setFile(null);
    // Reset the file input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const processFile = async () => {
    if (!file) return;

    setUploading(true);

    try {
      // Store the file in our upload store
      uploadStore.set(file);
      
      // Run transcription
      const transcript = await runTranscription(file);
      
      // Store just the transcript data in localStorage
      localStorage.setItem('currentTranscript', JSON.stringify(transcript));
      
      // Navigate to transcript page after processing
      router.push('/transcriptPage');
    } catch (error) {
      console.error('Transcription failed:', error);
      alert('Failed to transcribe the audio file. Please try again.');
    } finally {
      setFile(null);
      // Reset the file input value after processing
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <div className="mx-auto max-w-xl p-6 space-y-6">
        <h1 className="text-2xl font-bold">Processing Audio</h1>
        <div className="space-y-4">
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="w-full h-full bg-blue-500 animate-[progress_1.5s_ease-in-out_infinite]" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Please wait while we process your audio file...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Upload an Audio File</h1>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <Upload className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">Drag and drop an audio file here</p>
            <p className="text-sm text-muted-foreground mt-1">Supports MP3, WAV, OGG, and other audio formats</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              Select File
            </Button>
            {file && (
              <Button 
                onClick={processFile} 
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold px-6"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Analyze Audio
                  </>
                )}
              </Button>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*"
            className="hidden"
          />
        </div>
      </div>

      {file && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Selected File</h2>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Music className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  Replace
                </Button>
                <Button variant="ghost" size="icon" onClick={removeFile} disabled={uploading}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
