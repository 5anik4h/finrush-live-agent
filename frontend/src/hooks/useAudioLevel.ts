import { useRef, useEffect } from 'react';

/**
 * Reads real-time audio voice-activity level (0–1) from a MediaStream.
 *
 * Uses TIME-DOMAIN RMS (not frequency average) so it accurately distinguishes
 * real voice energy from ambient background noise. Returns a ref that updates
 * every animation frame — no re-renders triggered.
 *
 * The value is held at 1.0 for VOICE_HOLD_MS after voice is detected to
 * prevent the inactivity timer from resetting during brief silences between
 * syllables/words.
 */

// Only update the timer when RMS exceeds this threshold.
// Ambient noise / air-con / keyboard is typically < 0.08.
// Human speech (even soft speaking) starts around 0.12–0.15.
const VOICE_RMS_THRESHOLD = 0.12;

// Once voice is detected, hold the "active" flag for this many ms.
// Prevents the countdown from ticking during natural pauses in speech.
const VOICE_HOLD_MS = 1500;

export function useAudioLevel(stream: MediaStream | null) {
  const levelRef = useRef(0);
  const lastVoiceTimeRef = useRef(0);

  useEffect(() => {
    if (!stream) {
      levelRef.current = 0;
      return;
    }

    let raf: number;
    let alive = true;

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    // Larger FFT = better frequency resolution (not needed here, but needed
    // for time-domain which is determined by fftSize/2).
    analyser.fftSize = 1024;
    source.connect(analyser);

    const timeDomainData = new Float32Array(analyser.fftSize);

    const tick = () => {
      if (!alive) return;

      // True RMS over the time-domain signal — accurately measures signal energy
      analyser.getFloatTimeDomainData(timeDomainData);
      let sumSquares = 0;
      for (let i = 0; i < timeDomainData.length; i++) {
        sumSquares += timeDomainData[i] * timeDomainData[i];
      }
      const rms = Math.sqrt(sumSquares / timeDomainData.length);

      const now = Date.now();

      if (rms >= VOICE_RMS_THRESHOLD) {
        // Voice detected: record time and set level to 1 (activity pulse)
        lastVoiceTimeRef.current = now;
        levelRef.current = Math.min(1, rms * 4); // scale to 0–1 range for orb animation
      } else if (now - lastVoiceTimeRef.current < VOICE_HOLD_MS) {
        // Hold: recently there was voice, don't reset yet
        // (handles natural pauses between words/syllables)
        levelRef.current = 0.5;
      } else {
        // Silence or just ambient noise — clear the level
        levelRef.current = 0;
      }

      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      source.disconnect();
      ctx.close().catch(() => { });
    };
  }, [stream]);

  return levelRef;
}
