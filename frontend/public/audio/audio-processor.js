/**
 * Custom AudioWorkletProcessor to handle real-time audio capture from the microphone.
 * It reads audio data from the input, resamples to 16kHz PCM (Pulse Code Modulation),
 * and posts the raw data buffers back to the main thread via the `port`.
 *
 * This is crucial for Gemini Live API, which expects raw 16kHz audio data.
 */
// Gemini Live API recommends sending audio in 40ms chunks (640 samples at 16kHz).
// The AudioWorklet process() callback fires every ~2.8ms (128 samples at 44.1kHz, resampled
// to ~46 samples at 16kHz). Sending each tiny chunk separately wastes WebSocket frame overhead
// and can cause Gemini VAD (voice activity detection) to misfire on silence boundaries.
// We accumulate resampled samples in a buffer and only post when we have 640 samples.
const TARGET_CHUNK_SIZE = 640; // 40ms @ 16kHz

class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._targetRate = 16000;
        // `sampleRate` is a global in AudioWorkletGlobalScope — it gives us
        // the AudioContext's actual sample rate (e.g. 44100 or 48000).
        this._ratio = sampleRate / this._targetRate;
        // Fractional accumulator for accurate resampling
        this._resampleOffset = 0;
        // Accumulation buffer: holds resampled Int16 samples until TARGET_CHUNK_SIZE is reached
        this._buffer = new Int16Array(TARGET_CHUNK_SIZE);
        this._bufferLen = 0;
    }

    process(inputs, _outputs, _parameters) {
        try {
            const input = inputs[0]; // Get the first input (usually microphone)
            if (input.length > 0) {
                const channelData = input[0]; // Get the first channel (mono)

                if (channelData && channelData.length > 0) {
                    let pcmData;

                    if (this._ratio <= 1.001) {
                        // Already at target rate (or very close) — no resampling needed
                        pcmData = new Int16Array(channelData.length);
                        for (let i = 0; i < channelData.length; i++) {
                            const s = Math.max(-1, Math.min(1, channelData[i]));
                            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                        }
                    } else {
                        // Resample from system rate to 16kHz using linear interpolation
                        const outLen = Math.floor((channelData.length - this._resampleOffset) / this._ratio);
                        if (outLen <= 0) return true;

                        pcmData = new Int16Array(outLen);
                        for (let i = 0; i < outLen; i++) {
                            const srcIdx = this._resampleOffset + i * this._ratio;
                            const idx = Math.floor(srcIdx);
                            const frac = srcIdx - idx;

                            // Linear interpolation between two neighbouring samples
                            const a = idx < channelData.length ? channelData[idx] : 0;
                            const b = (idx + 1) < channelData.length ? channelData[idx + 1] : a;
                            const sample = a + frac * (b - a);

                            const s = Math.max(-1, Math.min(1, sample));
                            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                        }

                        // Keep fractional remainder for seamless next-block stitching
                        this._resampleOffset = (this._resampleOffset + outLen * this._ratio) - channelData.length;
                        if (this._resampleOffset < 0) this._resampleOffset = 0;
                    }

                    // Accumulate resampled samples and flush in TARGET_CHUNK_SIZE batches.
                    // This prevents sending hundreds of tiny (~46-sample) WebSocket frames
                    // and aligns with Gemini's recommended 40ms audio chunk size.
                    let srcOffset = 0;
                    while (srcOffset < pcmData.length) {
                        const spaceLeft = TARGET_CHUNK_SIZE - this._bufferLen;
                        const available = pcmData.length - srcOffset;
                        const toCopy = Math.min(spaceLeft, available);

                        this._buffer.set(pcmData.subarray(srcOffset, srcOffset + toCopy), this._bufferLen);
                        this._bufferLen += toCopy;
                        srcOffset += toCopy;

                        if (this._bufferLen >= TARGET_CHUNK_SIZE) {
                            // Buffer is full — post a copy (the buffer itself will be reused)
                            const chunk = this._buffer.buffer.slice(0);
                            this.port.postMessage(chunk, [chunk]);
                            this._bufferLen = 0;
                        }
                    }
                }
            }
            // Return true to keep the processor alive
            return true;
        } catch (e) {
            this.port.postMessage({ error: e.message });
            return true;
        }
    }
}

// Register the processor so it can be used by the AudioWorklet node in the main thread
registerProcessor('pcm-processor', PCMProcessor);
