"use client";

/**
 * OrbAnimation — WebGL orb from react-bits adapted for agent state machine.
 *
 * States:
 *  idle      → slow organic movement, blue hue (default)
 *  recording → accelerated, brighter, distorted (user holding mic)
 *  thinking  → hue shifts to purple + particle explosion, relaxed motion
 *  idle (from thinking) → orb contracts then returns to base
 */

import { useEffect, useRef, useState } from "react";
import { Mesh, Program, Renderer, Triangle, Vec3 } from "ogl";

type AgentState = "idle" | "recording" | "thinking" | "error";

interface OrbAnimationProps {
  agentState: AgentState;
  audioLevel?: React.RefObject<number>;
  size?: number;
  isProcessing?: boolean;
  isActive?: boolean;
}

// ── Particle for the explosion burst ──────────────────────────────────────────
interface Burst {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  r: number; g: number; b: number;
}

// ── GLSL shaders (react-bits Orb, slightly extended) ─────────────────────────
const VERT = /* glsl */ `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float iTime;
  uniform vec3  iResolution;
  uniform float hue;
  uniform float hover;
  uniform float rot;
  uniform float hoverIntensity;
  uniform float speedMul;
  uniform float scaleMul;
  uniform vec3  backgroundColor;
  varying vec2 vUv;

  vec3 rgb2yiq(vec3 c){
    float y=dot(c,vec3(0.299,0.587,0.114));
    float i=dot(c,vec3(0.596,-0.274,-0.322));
    float q=dot(c,vec3(0.211,-0.523,0.312));
    return vec3(y,i,q);
  }
  vec3 yiq2rgb(vec3 c){
    float r=c.x+0.956*c.y+0.621*c.z;
    float g=c.x-0.272*c.y-0.647*c.z;
    float b=c.x-1.106*c.y+1.703*c.z;
    return vec3(r,g,b);
  }
  vec3 adjustHue(vec3 color,float hueDeg){
    float hueRad=hueDeg*3.14159265/180.0;
    vec3 yiq=rgb2yiq(color);
    float cosA=cos(hueRad); float sinA=sin(hueRad);
    float i=yiq.y*cosA-yiq.z*sinA;
    float q=yiq.y*sinA+yiq.z*cosA;
    yiq.y=i; yiq.z=q;
    return yiq2rgb(yiq);
  }
  vec3 hash33(vec3 p3){
    p3=fract(p3*vec3(0.1031,0.11369,0.13787));
    p3+=dot(p3,p3.yxz+19.19);
    return -1.0+2.0*fract(vec3(p3.x+p3.y,p3.x+p3.z,p3.y+p3.z)*p3.zyx);
  }
  float snoise3(vec3 p){
    const float K1=0.333333333; const float K2=0.166666667;
    vec3 i=floor(p+(p.x+p.y+p.z)*K1);
    vec3 d0=p-(i-(i.x+i.y+i.z)*K2);
    vec3 e=step(vec3(0.0),d0-d0.yzx);
    vec3 i1=e*(1.0-e.zxy); vec3 i2=1.0-e.zxy*(1.0-e);
    vec3 d1=d0-(i1-K2); vec3 d2=d0-(i2-K1); vec3 d3=d0-0.5;
    vec4 h=max(0.6-vec4(dot(d0,d0),dot(d1,d1),dot(d2,d2),dot(d3,d3)),0.0);
    vec4 n=h*h*h*h*vec4(dot(d0,hash33(i)),dot(d1,hash33(i+i1)),dot(d2,hash33(i+i2)),dot(d3,hash33(i+1.0)));
    return dot(vec4(31.316),n);
  }
  vec4 extractAlpha(vec3 colorIn){
    float a=max(max(colorIn.r,colorIn.g),colorIn.b);
    return vec4(colorIn.rgb/(a+1e-5),a);
  }

  const vec3 baseColor1=vec3(0.784314,1.0,0.0);        // lime #C8FF00
  const vec3 baseColor2=vec3(0.541176,0.721569,0.2);   // green-lime #8ABC33
  const vec3 baseColor3=vec3(0.4,0.564706,0.2);        // dark green
  const float innerRadius=0.6;
  const float noiseScale=0.65;

  float light1(float intensity,float attenuation,float dist){return intensity/(1.0+dist*attenuation);}
  float light2(float intensity,float attenuation,float dist){return intensity/(1.0+dist*dist*attenuation);}

  vec4 draw(vec2 uv){
    vec3 color1=adjustHue(baseColor1,hue);
    vec3 color2=adjustHue(baseColor2,hue);
    vec3 color3=adjustHue(baseColor3,hue);

    float ang=atan(uv.y,uv.x);
    float len=length(uv);
    float invLen=len>0.0?1.0/len:0.0;
    float bgLuminance=dot(backgroundColor,vec3(0.299,0.587,0.114));

    float t=iTime*speedMul;
    float n0=snoise3(vec3(uv*noiseScale,t*0.5))*0.5+0.5;
    float r0=mix(mix(innerRadius,1.0,0.4),mix(innerRadius,1.0,0.6),n0);
    float d0=distance(uv,(r0*invLen)*uv);
    float v0=light1(1.0,10.0,d0);
    v0*=smoothstep(r0*1.05,r0,len);
    float innerFade=smoothstep(r0*0.8,r0*0.95,len);
    v0*=mix(innerFade,1.0,bgLuminance*0.7);
    float cl=cos(ang+t*2.0)*0.5+0.5;

    float a=t*-1.0;
    vec2 pos=vec2(cos(a),sin(a))*r0;
    float d=distance(uv,pos);
    float v1=light2(1.5,5.0,d);
    v1*=light1(1.0,50.0,d0);

    float v2=smoothstep(1.0,mix(innerRadius,1.0,n0*0.5),len);
    float v3=smoothstep(innerRadius,mix(innerRadius,1.0,0.5),len);

    vec3 colBase=mix(color1,color2,cl);
    float fadeAmount=mix(1.0,0.1,bgLuminance);

    vec3 darkCol=mix(color3,colBase,v0);
    darkCol=(darkCol+v1)*v2*v3;
    darkCol=clamp(darkCol,0.0,1.0);

    vec3 lightCol=(colBase+v1)*mix(1.0,v2*v3,fadeAmount);
    lightCol=mix(backgroundColor,lightCol,v0);
    lightCol=clamp(lightCol,0.0,1.0);

    vec3 finalCol=mix(darkCol,lightCol,bgLuminance);
    return extractAlpha(finalCol);
  }

  vec4 mainImage(vec2 fragCoord){
    vec2 center=iResolution.xy*0.5;
    float size=min(iResolution.x,iResolution.y)*scaleMul;
    vec2 uv=(fragCoord-center)/size*2.0;

    float s=sin(rot); float c=cos(rot);
    uv=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y);

    uv.x+=hover*hoverIntensity*0.1*sin(uv.y*10.0+iTime);
    uv.y+=hover*hoverIntensity*0.1*sin(uv.x*10.0+iTime);

    return draw(uv);
  }

  void main(){
    vec2 fragCoord=vUv*iResolution.xy;
    vec4 col=mainImage(fragCoord);
    gl_FragColor=vec4(col.rgb*col.a,col.a);
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export default function OrbAnimation({ agentState, audioLevel, size = 300, isProcessing = false, isActive = true }: OrbAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<AgentState>("idle");
  const isProcessingRef = useRef(false);
  const isActiveRef = useRef(true);
  stateRef.current = agentState;
  isProcessingRef.current = isProcessing;
  isActiveRef.current = isActive;
  const [isReady, setIsReady] = useState(false);

  // 2D overlay canvas for particle burst
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const burstsRef = useRef<Burst[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    // Reset ready state so the opacity transition works on re-init
    setIsReady(false);

    // Clear any leftover canvases from a previous run
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // ── Overlay canvas (particles) ──
    const dpr = window.devicePixelRatio || 1;
    overlay.width = size * dpr;
    overlay.height = size * dpr;
    overlay.style.width = `${size}px`;
    overlay.style.height = `${size}px`;
    const octxRaw = overlay.getContext("2d");
    if (!octxRaw) return;
    const octx = octxRaw;
    octx.scale(dpr, dpr);

    // ── WebGL orb ──
    let contextLost = false;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    } catch {
      // WebGL not available — skip rendering, show nothing
      console.warn("OrbAnimation: WebGL not available");
      return;
    }
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const glCanvas = gl.canvas as HTMLCanvasElement;
    glCanvas.style.background = "transparent";

    // Handle WebGL context loss / restoration
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      console.warn("OrbAnimation: WebGL context lost");
    };
    const handleContextRestored = () => {
      contextLost = false;
      console.info("OrbAnimation: WebGL context restored");
    };
    glCanvas.addEventListener("webglcontextlost", handleContextLost);
    glCanvas.addEventListener("webglcontextrestored", handleContextRestored);
    container.appendChild(glCanvas);

    const geo = new Triangle(gl);
    const prog = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Vec3(size * dpr, size * dpr, 1) },
        hue: { value: 0 },
        hover: { value: 0 },
        rot: { value: 0 },
        hoverIntensity: { value: 0.2 },
        speedMul: { value: 1.0 },
        scaleMul: { value: 1.0 },
        backgroundColor: { value: new Vec3(0, 0, 0) },
      },
    });
    const mesh = new Mesh(gl, { geometry: geo, program: prog });

    // Pause when tab is hidden to avoid GPU conflicts
    let paused = false;
    const handleVisibility = () => { paused = document.hidden; };
    document.addEventListener("visibilitychange", handleVisibility);

    function resize() {
      const w = size, h = size;
      renderer.setSize(w * dpr, h * dpr);
      glCanvas.style.width = `${w}px`;
      glCanvas.style.height = `${h}px`;
      prog.uniforms.iResolution.value.set(w * dpr, h * dpr, 1);
    }
    resize();

    // ── State-driven animation vars ──
    let currentHue = 0;      // target: 0 idle, -60 recording, 240 thinking (more purple/lilac)
    let currentSpeed = 1.0;    // target: 1 idle, 1.8 recording (elegant acceleration), 0.32 thinking
    let currentIntensity = 0.2;  // target hoverIntensity
    let currentScale = 1.0;   // target scaleMul (0.7 → 1 after thinking)
    let currentRot = 0.0;
    let prevState: AgentState = "idle";

    function spawnExplosion() {
      const cx = size / 2, cy = size / 2;
      const bursts: Burst[] = [];
      for (let i = 0; i < 80; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        const dist = size * 0.18 + Math.random() * size * 0.12;
        // Shift from blue to purple/violet
        bursts.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          maxLife: 0.7 + Math.random() * 1.1,
          size: 1.5 + Math.random() * 3,
          r: 0.55 + Math.random() * 0.35,
          g: 0.05 + Math.random() * 0.25,
          b: 0.9 + Math.random() * 0.1,
        });
      }
      burstsRef.current = bursts;
    }

    let lastT = 0;
    let rafId: number;
    let destroyed = false;
    let readySignaled = false;

    function update(t: number) {
      if (destroyed) return;
      rafId = requestAnimationFrame(update);

      // Skip frames while paused (tab hidden), context lost or not active
      if (paused || contextLost || !isActiveRef.current) { lastT = t; return; }

      const dt = Math.min((t - lastT) * 0.001, 0.05);
      lastT = t;

      const state = stateRef.current;
      const audio = audioLevel?.current ?? 0;

      // ── State transitions ──────────────────────────────────────────────
      if (prevState !== state) {
        if (prevState === "recording" && state === "thinking") {
          spawnExplosion();
          currentScale = 0.72; // contract briefly
        }
        if (prevState === "thinking" && state === "idle") {
          currentScale = 0.72; // contract on answer
        }
        prevState = state;
      }

      // ── Target values per state ────────────────────────────────────────
      const isProcessing = isProcessingRef.current;
      const targetHue = isProcessing ? 60  // shift to orange-amber
        : state === "thinking" ? 60        // orange-amber for agent thinking
          : state === "recording" ? 30       // shift to brighter yellow-lime for recording
            : state === "error" ? 90         // shift toward red
              : 0;                                // green-lime for idle
      const targetSpeed = state === "recording"
        ? 1.4 + audio * 0.6
        : state === "thinking" ? 0.32
          : state === "error" ? 0.6
            : 1.0;
      const targetIntensity = state === "recording"
        ? 0.55 + audio * 0.6
        : state === "thinking" ? 0.15
          : state === "error" ? 0.7
            : 0.2;
      const targetScale = 1.0; // always return to 1

      // ── Smooth interpolation ───────────────────────────────────────────
      const hueRate = 0.04;
      const speedRate = state === "recording" ? 0.08 : 0.06; // smooth speed transitions
      const scaleRate = state === "thinking" ? 0.03 : 0.05;

      currentHue = lerp(currentHue, targetHue, hueRate);
      currentSpeed = lerp(currentSpeed, targetSpeed, speedRate);
      currentIntensity = lerp(currentIntensity, targetIntensity, 0.08);
      currentScale = lerp(currentScale, targetScale, scaleRate);

      // Slow rotation — recording spins faster
      const rotSpeed = state === "recording" ? 0.8 + audio * 1.5 : 0.15;
      currentRot += dt * rotSpeed;

      // Force hover at 1 when recording/thinking
      const targetHover = (state === "recording" || state === "thinking") ? 1.0 : 0.0;
      prog.uniforms.hover.value = lerp(prog.uniforms.hover.value, targetHover, 0.1);

      prog.uniforms.iTime.value = t * 0.001;
      prog.uniforms.hue.value = currentHue;
      prog.uniforms.rot.value = currentRot;
      prog.uniforms.speedMul.value = currentSpeed;
      prog.uniforms.scaleMul.value = currentScale;
      prog.uniforms.hoverIntensity.value = currentIntensity;

      try {
        renderer.render({ scene: mesh });
      } catch {
        // Context may have been lost between check and render — skip this frame
        return;
      }
      if (!readySignaled) {
        readySignaled = true;
        setIsReady(true);
      }

      // ── Particle overlay ──────────────────────────────────────────────
      octx.clearRect(0, 0, size, size);
      const bursts = burstsRef.current;
      if (bursts.length > 0) {
        octx.globalCompositeOperation = "screen";
        for (let i = bursts.length - 1; i >= 0; i--) {
          const p = bursts[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.93;
          p.vy *= 0.93;
          p.vy -= 0.03; // float upward
          p.life -= dt / p.maxLife;
          if (p.life <= 0) { bursts.splice(i, 1); continue; }

          const alpha = Math.pow(p.life, 1.5) * 0.85;
          const s = p.size * (1 + (1 - p.life) * 1.8);
          const grad = octx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
          grad.addColorStop(0, `rgba(${Math.round(p.r * 255)},${Math.round(p.g * 255)},${Math.round(p.b * 255)},${alpha})`);
          grad.addColorStop(0.4, `rgba(${Math.round(p.r * 255)},${Math.round(p.g * 255)},${Math.round(p.b * 255)},${alpha * 0.3})`);
          grad.addColorStop(1, "transparent");
          octx.fillStyle = grad;
          octx.beginPath();
          octx.arc(p.x, p.y, s, 0, Math.PI * 2);
          octx.fill();
        }
        octx.globalCompositeOperation = "source-over";
      }
    }

    rafId = requestAnimationFrame(update);

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", handleVisibility);
      glCanvas.removeEventListener("webglcontextlost", handleContextLost);
      glCanvas.removeEventListener("webglcontextrestored", handleContextRestored);
      try {
        if (glCanvas.parentNode === container) {
          container.removeChild(glCanvas);
        }
      } catch { /* already removed */ }
      try {
        if (!contextLost) {
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        }
      } catch { /* context already lost */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    <div
      style={{ position: "relative", width: size, height: size, opacity: isReady ? 1 : 0, transition: "opacity 0.4s ease-out" }}
    >
      {/* WebGL canvas (injected by ogl renderer) */}
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, background: "transparent" }}
      />
      {/* Particle overlay */}
      <canvas
        ref={overlayRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          width: size,
          height: size,
        }}
      />
    </div>
  );
}
