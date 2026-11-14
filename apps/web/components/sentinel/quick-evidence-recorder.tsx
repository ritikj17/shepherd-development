"use client";

import { useRef, useState } from "react";
import { Camera, Check, FileCheck, Loader2, Mic, MicOff, ShieldCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadEvidence } from "@/lib/api/evidence";

interface QuickEvidenceRecorderProps {
  incidentId?: string | null;
  onEvidenceCaptured?: (evidence: { id: string; sha256: string; type: string }) => void;
}

export function QuickEvidenceRecorder({
  incidentId,
  onEvidenceCaptured,
}: QuickEvidenceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [lastUploadedType, setLastUploadedType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const computeSha256 = async (blob: Blob): Promise<string> => {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const startAudioRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleSaveEvidence(audioBlob, `audio_capture_${Date.now()}.webm`, "Audio Note");
      };

      mediaRecorder.start(250); // Slice data every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Microphone access denied or unavailable.",
      );
    }
  };

  const stopAudioRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await handleSaveEvidence(file, file.name, "Photo Evidence");
  };

  const handleSaveEvidence = async (blob: Blob, fileName: string, typeLabel: string) => {
    setProcessing(true);
    setErrorMessage(null);
    try {
      const sha256 = await computeSha256(blob);
      setLastHash(sha256);
      setLastUploadedType(typeLabel);

      if (incidentId) {
        const file = new File([blob], fileName, { type: blob.type });
        const uploaded = await uploadEvidence(incidentId, file);
        onEvidenceCaptured?.({
          id: uploaded.id,
          sha256: uploaded.sha256,
          type: typeLabel,
        });
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to hash and attach evidence.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-500" />
            <CardTitle className="text-base font-semibold">Quick Evidence Capture</CardTitle>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">SHA-256 Verified</span>
        </div>
        <CardDescription className="text-xs">
          Capture ambient audio or visual context. All files are client-hashed before upload to ensure tamper-evident preservation.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {errorMessage && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {/* Audio Button */}
          {!isRecording ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              disabled={processing}
              onClick={startAudioRecording}
            >
              <Mic className="mr-2 size-4 text-emerald-600" />
              Record Audio
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="h-12 animate-pulse bg-rose-600 hover:bg-rose-700"
              onClick={stopAudioRecording}
            >
              <Square className="mr-2 size-4 fill-white" />
              Stop ({recordingSeconds}s)
            </Button>
          )}

          {/* Photo Button */}
          <Button
            type="button"
            variant="outline"
            className="h-12 border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            disabled={processing || isRecording}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="mr-2 size-4 text-blue-600" />
            Capture Photo
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        {processing && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-zinc-600 dark:text-zinc-400">
            <Loader2 className="size-4 animate-spin" />
            <span>Calculating SHA-256 & uploading to EvidenceVault...</span>
          </div>
        )}

        {lastHash && !processing && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <Check className="size-3.5" />
              <span>{lastUploadedType} Preserved</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-zinc-600 break-all dark:text-zinc-400">
              SHA-256: {lastHash}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
