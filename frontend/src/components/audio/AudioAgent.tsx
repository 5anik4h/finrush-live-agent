"use client"

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAudioStream } from '@/hooks/useAudioStream';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioAgentProps {
    onImageData?: (fn: (base64: string, mime: string) => void) => void;
}

export function AudioAgent({ onImageData }: AudioAgentProps) {
    const { session } = useAuth();

    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || "";
    const token = session?.access_token || null;

    const {
        isRecording,
        isConnected,
        transcripts,
        startRecording,
        stopRecording,
        sendImageData,
        error
    } = useAudioStream(wsBaseUrl, token);

    useEffect(() => {
        if (onImageData) {
            onImageData(sendImageData);
        }
    }, [sendImageData, onImageData]);

    // Auto scroll transcript to bottom
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [transcripts]);

    return (
        <div className="w-full max-w-2xl mx-auto space-y-8">

            {/* Visualizer & Controls */}
            <div className="relative group">
                <div className={cn(
                    "absolute -inset-0.5 rounded-3xl blur opacity-20 transition duration-1000",
                    isRecording
                        ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-60 animate-pulse"
                        : "bg-white/10"
                )} />

                <div className="relative bg-zinc-950 border border-white/10 p-8 rounded-3xl flex flex-col items-center justify-center min-h-[250px] overflow-hidden">

                    {/* Subtle background waves animation when active */}
                    {isRecording && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            <div className="w-32 h-32 rounded-full border-2 border-emerald-500 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                            <div className="w-48 h-48 absolute rounded-full border-2 border-teal-500 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
                        </div>
                    )}

                    <div className="z-10 flex flex-col items-center space-y-6">
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={cn(
                                "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl",
                                isRecording
                                    ? "bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20"
                                    : "bg-gradient-to-tr from-emerald-400 to-teal-500 text-black hover:scale-105"
                            )}
                        >
                            {isRecording ? (
                                <Square fill="currentColor" className="w-8 h-8" />
                            ) : (
                                <Mic fill="currentColor" className="w-10 h-10" />
                            )}
                        </button>

                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-medium text-white">
                                {isRecording ? "Listening & Processing..." : "Tap to Speak"}
                            </h3>
                            <p className="text-sm text-zinc-400 flex items-center justify-center space-x-2">
                                {isRecording && !isConnected && (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Connecting to Engine...</span>
                                    </>
                                )}
                                {isRecording && isConnected && (
                                    <span className="text-emerald-400">Live Agent Connected</span>
                                )}
                                {!isRecording && (
                                    <span>Finrush is standing by</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3 text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium">Connection Error</p>
                        <p className="opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {/* Transcripts Window */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 h-[250px] overflow-y-auto flex flex-col space-y-4 scroll-smooth">
                {transcripts.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                        Agent transcripts will appear here...
                    </div>
                ) : (
                    transcripts.map((text, i) => (
                        <div key={i} className="text-sm text-zinc-300 animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-teal-400 font-semibold mr-2">Agent:</span>
                            {text}
                        </div>
                    ))
                )}
                <div ref={transcriptEndRef} />
            </div>

        </div>
    );
}
