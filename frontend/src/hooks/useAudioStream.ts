import { useState, useRef, useCallback, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useWebSocket } from './useWebSocket';

export function useAudioStream(wsUrl: string, token: string | null, lang: string = 'en', currency: string = 'USD') {
    const [isRecording, setIsRecording] = useState(false);
    const [transcripts, setTranscripts] = useState<string[]>([]);
    const [inputTranscripts, setInputTranscripts] = useState<string[]>([]);
    const [turnComplete, setTurnComplete] = useState(0); // increments each time agent finishes a turn;
    const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

    // Audio Context refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const playContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    // Tracks whether the worklet module has been loaded into the AudioContext
    const workletLoadedRef = useRef(false);

    // Playback queue refs
    const playbackQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlayingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Use a ref for stopRecording so it can be safely called inside startRecording
    // without creating a circular dependency between useCallback declarations.
    const stopRecordingRef = useRef<() => void>(() => { });

    const [refreshData, setRefreshData] = useState(0); // increments when data mutates

    // Stable callbacks — memoized so they never recreate useWebSocket's `connect`
    const handleAudioData = useCallback((data: ArrayBuffer) => {
        playbackQueueRef.current.push(data);
        setIsAgentSpeaking(true);
        playNextRef.current();
    }, []);

    const handleInterrupt = useCallback(() => {
        try {
            playbackQueueRef.current = [];
            if (currentSourceRef.current) {
                currentSourceRef.current.stop();
                currentSourceRef.current.disconnect();
                currentSourceRef.current = null;
            }
            isPlayingRef.current = false;
            setIsAgentSpeaking(false);
        } catch (e) {
            Sentry.captureException(e, {
                tags: { component: 'useAudioStream', action: 'onInterrupt' },
            });
        }
    }, []);

    const handleText = useCallback((text: string) => {
        setTranscripts(prev => [...prev, text]);
    }, []);

    const handleInputTranscript = useCallback((text: string) => {
        setInputTranscripts(prev => [...prev, text]);
    }, []);

    const handleTurnComplete = useCallback(() => {
        setTurnComplete(prev => prev + 1);
    }, []);

    const handleRefreshData = useCallback(() => {
        setRefreshData(prev => prev + 1);
    }, []);

    const { isConnected, connect, disconnect, sendAudioData, sendImageData, sendTextMessage, isReadyToSend, error } = useWebSocket({
        url: wsUrl,
        token: token,
        lang,
        currency,
        onAudioData: handleAudioData,
        onInterrupt: handleInterrupt,
        onText: handleText,
        onInputTranscript: handleInputTranscript,
        onTurnComplete: handleTurnComplete,
        onRefreshData: handleRefreshData,
    });

    // Use a ref for playNext to avoid circular deps with useCallback
    const playNextRef = useRef<() => Promise<void>>(async () => { });

    const playNext = useCallback(async () => {
        if (isPlayingRef.current || playbackQueueRef.current.length === 0) {
            if (playbackQueueRef.current.length === 0) {
                setIsAgentSpeaking(false);
            }
            return;
        }

        if (!playContextRef.current) {
            playContextRef.current = new window.AudioContext({ sampleRate: 24000 });
        }

        try {
            isPlayingRef.current = true;
            setIsAgentSpeaking(true);
            const arrayBuffer = playbackQueueRef.current.shift()!;

            const audioCtx = playContextRef.current;
            const int16Data = new Int16Array(arrayBuffer);

            const audioBuffer = audioCtx.createBuffer(1, int16Data.length, 24000);
            const float32Data = audioBuffer.getChannelData(0);

            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }

            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);

            currentSourceRef.current = source;

            source.onended = () => {
                isPlayingRef.current = false;
                currentSourceRef.current = null;
                // Using ref to avoid circular dependency
                playNextRef.current();
            };

            source.start();
        } catch (e) {
            console.error("Error playing audio chunk", e);
            Sentry.captureException(e, {
                tags: { component: 'useAudioStream', action: 'playAudioChunk' },
                extra: { queueLength: playbackQueueRef.current.length },
            });
            isPlayingRef.current = false;
            setIsAgentSpeaking(false);
            playNextRef.current();
        }
    }, []);

    // Keep the ref in sync with the latest version
    useEffect(() => {
        playNextRef.current = playNext;
    }, [playNext]);

    const cleanupAudio = useCallback(async () => {
        // Step 1 — Disconnect all nodes
        if (sourceNodeRef.current) {
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
        }
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }
        if (currentSourceRef.current) {
            currentSourceRef.current.stop();
            currentSourceRef.current.disconnect();
            currentSourceRef.current = null;
        }

        // Step 2 — Clean up MediaStream tracks
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        // Step 3 — Close AudioContexts
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try {
                await audioContextRef.current.close();
            } catch (e) {
                console.error("Error closing recording AudioContext", e);
                Sentry.captureException(e, { tags: { component: 'useAudioStream', action: 'closeRecordingContext' } });
            }
            audioContextRef.current = null;
            workletLoadedRef.current = false;
        }

        if (playContextRef.current && playContextRef.current.state !== 'closed') {
            try {
                await playContextRef.current.close();
            } catch (e) {
                console.error("Error closing playback AudioContext", e);
                Sentry.captureException(e, { tags: { component: 'useAudioStream', action: 'closePlaybackContext' } });
            }
            playContextRef.current = null;
        }

        isPlayingRef.current = false;
        setIsAgentSpeaking(false);
        playbackQueueRef.current = [];
    }, []);

    const stopRecording = useCallback(async () => {
        await cleanupAudio();
        setIsRecording(false);
    }, [cleanupAudio]);

    // Keep the ref in sync so startRecording can call it without circular dep
    useEffect(() => {
        stopRecordingRef.current = stopRecording;
    }, [stopRecording]);

    const startRecording = useCallback(async () => {
        try {
            // Ensure we're in a clean state before starting
            await cleanupAudio();

            // Step 1 — Request microphone FIRST to get its native sample rate
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                    }
                });
            } catch (err) {
                console.error('Failed to get microphone access:', err);
                Sentry.captureException(err, {
                    tags: { component: 'useAudioStream', action: 'getUserMedia' },
                });
                throw err;
            }
            mediaStreamRef.current = stream;

            // Step 2 — Create/resume AudioContext
            const AudioContextClass = window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new AudioContextClass();
                workletLoadedRef.current = false;
            }

            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            // Step 3 — Load worklet module only once
            if (!workletLoadedRef.current) {
                try {
                    await audioContextRef.current.audioWorklet.addModule('/audio/audio-processor.js');
                    workletLoadedRef.current = true;
                } catch (err) {
                    console.error('Failed to load worklet module:', err);
                    Sentry.captureException(err, {
                        tags: { component: 'useAudioStream', action: 'addWorkletModule' },
                    });
                    workletLoadedRef.current = false;
                    throw err;
                }
            }

            // Step 4 — Wire audio graph
            try {
                sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
                workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
                workletNodeRef.current.port.onmessage = (event) => {
                    sendAudioData(event.data);
                };
                sourceNodeRef.current.connect(workletNodeRef.current);
            } catch (err) {
                console.error('Failed to set up audio graph:', err);
                Sentry.captureException(err, {
                    tags: { component: 'useAudioStream', action: 'setupAudioGraph' },
                });
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                throw err;
            }

            // Step 5 — Open WebSocket and mark as recording
            connect();
            setIsRecording(true);

        } catch (err) {
            console.error('Error starting audio stream', err);
            await cleanupAudio();
            throw err;
        }
    }, [cleanupAudio, connect, sendAudioData]);

    // PRE-CONNECT: Attempt to warm up the WebSocket as soon as we have a token
    // This solves the issue where the first voice interaction fails because
    // the connection wasn't ready yet.
    useEffect(() => {
        if (token && !isRecording) {
            connect();
        }
    }, [token, connect, isRecording]);

    // LANG/CURRENCY CHANGE: Reconnect WebSocket so the new lang/currency is sent
    // in the setup message and the system prompt is regenerated server-side.
    // The server-side ring buffer is keyed by user_id (not session), so conversation
    // memory is preserved across reconnections.
    // We skip the first render (isMountedRef) to avoid an extra connect on startup.
    const isMountedRef = useRef(false);
    useEffect(() => {
        if (!isMountedRef.current) {
            isMountedRef.current = true;
            return;
        }
        if (!token) return;
        // Disconnect and reconnect with new lang/currency in setup message.
        // connect() is memoized with [url, lang, currency] so it already carries new values.
        disconnect();
        const timer = setTimeout(() => {
            connect();
        }, 300); // brief delay to let backend close the old session
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang, currency]);

    // Clean-up on unmount
    useEffect(() => {
        return () => {
            cleanupAudio();
        };
    }, [cleanupAudio]);

    // Wait for WS to open, then send. Polls every 100ms, up to 5s.
    const sendWhenReady = useCallback((send: () => void) => {
        connect();
        let attempts = 0;
        const poll = setInterval(() => {
            if (isReadyToSend()) {
                clearInterval(poll);
                send();
            } else if (++attempts > 50) {
                clearInterval(poll);
                Sentry.captureMessage('sendWhenReady: WebSocket did not open within 5s', {
                    level: 'error',
                    tags: { component: 'useAudioStream', action: 'sendWhenReady' },
                });
            }
        }, 100);
    }, [connect, isReadyToSend]);

    // Wrappers that auto-connect for text/image (no mic needed)
    const sendText = useCallback((text: string) => {
        sendWhenReady(() => sendTextMessage(text));
    }, [sendWhenReady, sendTextMessage]);

    const sendImage = useCallback((base64: string, mimeType: string) => {
        sendWhenReady(() => sendImageData(base64, mimeType));
    }, [sendWhenReady, sendImageData]);

    return {
        isRecording,
        isAgentSpeaking,
        isConnected,
        transcripts,
        inputTranscripts,
        turnComplete,
        startRecording,
        stopRecording,
        sendImageData: sendImage,
        sendTextMessage: sendText,
        mediaStreamRef,
        error,
        isReadyToSend,
        refreshData,
        connect,
        cleanupAudio
    };
}
