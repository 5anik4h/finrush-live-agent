import { useEffect, useRef, useState, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';

import { z } from 'zod';

const WebSocketMessageSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('interrupt'), message: z.string().optional() }),
    z.object({ type: z.literal('text'), text: z.string() }),
    z.object({ type: z.literal('input_transcript'), text: z.string() }),
    z.object({ type: z.literal('turn_complete') }),
    z.object({ type: z.literal('refresh_data') }),
    z.object({ type: z.literal('pong') }),
    z.object({ type: z.literal('error'), message: z.string().optional() }),
    // Gemini signals server is about to disconnect (e.g. model rollover, capacity rebalance).
    // We store the resumption_token so the next connection can resume the session seamlessly.
    z.object({ type: z.literal('go_away'), time_left: z.string().optional(), resumption_token: z.string().optional() }),
]);


interface UseWebSocketOptions {
    url: string;
    token: string | null;
    onAudioData: (data: ArrayBuffer) => void;
    onInterrupt: () => void;
    onText: (text: string) => void;
    onInputTranscript?: (text: string) => void;
    onTurnComplete?: () => void;
    onRefreshData?: () => void;
    lang?: string;
    currency?: string;
}

export function useWebSocket({ url, token, onAudioData, onInterrupt, onText, onInputTranscript, onTurnComplete, onRefreshData, lang = 'en', currency = 'USD' }: UseWebSocketOptions) {
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 5;

    const tokenRef = useRef(token);
    // Stores the Gemini session resumption token from the last go_away message.
    // Passed in the setup message on reconnect so Gemini can restore conversation context.
    const resumptionTokenRef = useRef<string | null>(null);

    // Keep refs for all callbacks so connect() never has to list them as deps.
    // This prevents connect() from being recreated on every render.
    const onAudioDataRef = useRef(onAudioData);
    const onInterruptRef = useRef(onInterrupt);
    const onTextRef = useRef(onText);
    const onInputTranscriptRef = useRef(onInputTranscript);
    const onTurnCompleteRef = useRef(onTurnComplete);
    const onRefreshDataRef = useRef(onRefreshData);

    useEffect(() => { tokenRef.current = token; }, [token]);
    useEffect(() => { onAudioDataRef.current = onAudioData; }, [onAudioData]);
    useEffect(() => { onInterruptRef.current = onInterrupt; }, [onInterrupt]);
    useEffect(() => { onTextRef.current = onText; }, [onText]);
    useEffect(() => { onInputTranscriptRef.current = onInputTranscript; }, [onInputTranscript]);
    useEffect(() => { onTurnCompleteRef.current = onTurnComplete; }, [onTurnComplete]);
    useEffect(() => { onRefreshDataRef.current = onRefreshData; }, [onRefreshData]);

    const connect = useCallback(function doConnect() {
        const currentToken = tokenRef.current;
        if (!currentToken) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

        try {
            const wsUrl = `${url}?lang=${encodeURIComponent(lang)}`;
            const ws = new WebSocket(wsUrl);
            ws.binaryType = 'arraybuffer';

            ws.onopen = () => {
                console.log('WebSocket connected');
                // Send setup message securely instead of URL to prevent token leakage
                // resumption_token (if any) lets Gemini restore a previous session context after go_away
                const setupMsg: Record<string, string> = { type: 'setup', token: currentToken, currency, lang };
                if (resumptionTokenRef.current) {
                    setupMsg.resumption_token = resumptionTokenRef.current;
                }
                ws.send(JSON.stringify(setupMsg));
                setIsConnected(true);
                setError(null);
                reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
            };

            ws.onmessage = (event) => {
                if (event.data instanceof ArrayBuffer) {
                    onAudioDataRef.current(event.data);
                } else if (typeof event.data === 'string') {
                    try {
                        const parsedData = JSON.parse(event.data);
                        const result = WebSocketMessageSchema.safeParse(parsedData);

                        if (!result.success) {
                            console.warn('Invalid WebSocket message schema:', result.error);
                            return;
                        }

                        const payload = result.data;
                        if (payload.type === 'interrupt') {
                            onInterruptRef.current();
                        } else if (payload.type === 'text') {
                            onTextRef.current(payload.text);
                        } else if (payload.type === 'input_transcript') {
                            onInputTranscriptRef.current?.(payload.text);
                        } else if (payload.type === 'turn_complete') {
                            onTurnCompleteRef.current?.();
                        } else if (payload.type === 'refresh_data') {
                            onRefreshDataRef.current?.();
                        } else if (payload.type === 'go_away') {
                            // Gemini is about to disconnect (server-side rebalance/rollover).
                            // Store the resumption token so the next reconnect can restore session context.
                            if (payload.resumption_token) {
                                resumptionTokenRef.current = payload.resumption_token;
                            }
                            console.log(`go_away received (time_left=${payload.time_left}) — stored resumption token`);
                        } else if (payload.type === 'error') {
                            console.error('WebSocket received error:', payload.message);
                            setError(payload.message || 'Server error');
                        }
                    } catch (e) {
                        console.error('Failed to parse WebSocket JSON message', e);
                        Sentry.captureException(e, {
                            tags: { component: 'useWebSocket', action: 'parseMessage' },
                            extra: { raw: typeof event.data === 'string' ? event.data.slice(0, 200) : null },
                        });
                    }
                }
            };

            ws.onerror = (e) => {
                console.error('WebSocket error', e);
                Sentry.captureMessage('WebSocket connection error', {
                    level: 'error',
                    tags: { component: 'useWebSocket' },
                });
                setError('Connection error');
            };

            ws.onclose = (event) => {
                console.log('WebSocket disconnected', event.code, event.reason);
                setIsConnected(false);
                wsRef.current = null;

                // Handle 1008 (policy violation) separately:
                // Some 1008 closures are recoverable (session duplicate, token expired)
                // Others are permanent (invalid token, invalid setup)
                if (event.code === 1008) {
                    const isRecoverable =
                        event.reason === 'Session already active' ||
                        event.reason === 'Token expired';

                    if (isRecoverable && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                        // Silently retry after 2s (session was overwritten or token renewed)
                        console.log(`Recoverable 1008 error, retrying in 2s: "${event.reason}"`);
                        setTimeout(() => {
                            reconnectAttemptsRef.current += 1;
                            doConnect();
                        }, 2000);

                        Sentry.captureMessage(`Recoverable 1008 closure, attempting silent reconnect: ${event.reason}`, {
                            level: 'info',
                            tags: { component: 'useWebSocket', recoverable: 'true' },
                        });
                        return;
                    } else {
                        // Permanent rejection: show error to user
                        console.warn('WebSocket rejected by server:', event.reason);
                        setError(event.reason || 'Session rejected by server');
                        Sentry.captureMessage(`Permanent 1008 closure: ${event.reason}`, {
                            level: 'warning',
                            tags: { component: 'useWebSocket', recoverable: 'false' },
                        });
                        return;
                    }
                }

                // Do NOT reconnect on other explicit server-side rejections:
                // 1000/1001: Normal/going away (user-initiated)
                // 1013: Try again later (server busy — wait for user to manually retry)
                const NO_RECONNECT_CODES = [1000, 1001, 1013];
                if (!NO_RECONNECT_CODES.includes(event.code)) {
                    if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                        const timeout = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
                        console.log(`Attempting reconnect in ${timeout}ms (Attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);

                        setTimeout(() => {
                            reconnectAttemptsRef.current += 1;
                            doConnect();
                        }, timeout);

                        Sentry.captureMessage(`WebSocket closed unexpectedly, attempting reconnect: ${event.code}`, {
                            level: 'warning',
                            tags: { component: 'useWebSocket', attempt: String(reconnectAttemptsRef.current + 1) },
                        });
                    } else {
                        setError('Connection failed after multiple attempts');
                        Sentry.captureMessage('WebSocket failed to reconnect after max attempts', {
                            level: 'error',
                            tags: { component: 'useWebSocket' },
                        });
                    }
                }
            };

            wsRef.current = ws;
        } catch (err) {
            Sentry.captureException(err, { tags: { component: 'useWebSocket', action: 'connect' } });
            setError(err instanceof Error ? err.message : 'Failed to connect');
        }
        // Only url, lang, and currency are true structural dependencies.
        // All callbacks are read from refs so they never trigger connect() recreation.
    }, [url, lang, currency]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            // Use 1000 to indicate normal closure, which stops reconnection logic
            wsRef.current.close(1000, 'User initiated disconnect');
            wsRef.current = null;
            setIsConnected(false);
            reconnectAttemptsRef.current = 0;
        }
    }, []);

    const sendAudioData = useCallback((pcmData: ArrayBuffer) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(pcmData);
        }
    }, []);

    const sendImageData = useCallback((base64: string, mimeType: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'image',
                data: base64,
                mime_type: mimeType
            }));
        }
    }, []);

    const sendTextMessage = useCallback((text: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'text', text }));
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    const isReadyToSend = useCallback(() =>
        wsRef.current?.readyState === WebSocket.OPEN, []);

    // ── Heartbeat ──────────────────────────────────────────────────────────
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isConnected) {
            interval = setInterval(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'ping' }));
                }
            }, 25000); // 25s heartbeat to keep Cloud Run from timing out
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isConnected]);

    return {
        isConnected,
        isReconnecting: reconnectAttemptsRef.current > 0 && !isConnected,
        error,
        connect,
        disconnect,
        sendAudioData,
        sendImageData,
        sendTextMessage,
        isReadyToSend,
    };
}
