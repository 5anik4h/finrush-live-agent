const MAX_DIMENSION = 768;  // Optimal for Gemini Live API vision analysis
const QUALITY_STEPS = [0.9, 0.7, 0.5, 0.3];

export async function compressImage(
  file: File,
  maxSizeBytes = 2.8 * 1024 * 1024
): Promise<{ base64: string; mimeType: string }> {
  // If already under limit, just convert to base64
  if (file.size <= maxSizeBytes && file.type === 'image/jpeg') {
    const base64 = await fileToBase64(file);
    return { base64, mimeType: file.type };
  }

  const img = await loadImage(file);
  const { width, height } = constrainDimensions(img.width, img.height, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // Try progressive quality reduction
  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob.size <= maxSizeBytes) {
      const base64 = await blobToBase64(blob);
      return { base64, mimeType: 'image/jpeg' };
    }
  }

  // Last resort: scale down further
  let scale = 0.75;
  while (scale > 0.1) {
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.5);
    if (blob.size <= maxSizeBytes) {
      const base64 = await blobToBase64(blob);
      return { base64, mimeType: 'image/jpeg' };
    }
    scale -= 0.15;
  }

  // Final fallback at minimum quality
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.3);
  const base64 = await blobToBase64(blob);
  return { base64, mimeType: 'image/jpeg' };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function constrainDimensions(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = Math.min(max / w, max / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), type, quality);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
