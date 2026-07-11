// Utilities for handling site identity media (logo / banner) safely.

// True when the value should be rendered inside an <img> / CSS url()
// instead of being printed as text. CRITICAL: base64 data URLs
// (data:image/png;base64,....) contain no dot and don't start with
// http or /, so without the `data:` check the app used to dump the
// entire multi-megabyte base64 string as TEXT into the header, which
// froze the browser and showed a blank white page.
export const isImageSource = (value: string): boolean => {
  const v = (value || '').trim().toLowerCase();
  if (!v) return false;
  return (
    v.startsWith('data:image/') ||
    v.startsWith('blob:') ||
    v.startsWith('http://') ||
    v.startsWith('https://') ||
    v.startsWith('/') ||
    /\.(png|jpe?g|webp|svg|gif)(\?.*)?$/.test(v) ||
    v.includes('unsplash.com') ||
    v.includes('dicebear.com')
  );
};

// A "logo" that is not an image source should only ever be a short
// emoji / tiny text. If a corrupted or huge value slips through,
// fall back to the berry so the UI can never be flooded with text.
export const safeEmojiOrFallback = (value: string, fallback = '🍇'): string => {
  const v = (value || '').trim();
  if (!v || v.length > 16) return fallback;
  return v;
};

// Downscale + re-encode an uploaded image so the stored data URL stays
// small enough for localStorage (~5MB quota) and berry_db.json.
// - Logos are capped at 256px, banners at 1600px.
// - SVG files are kept as-is (vector, usually tiny) unless oversized.
export const compressImageFile = (
  file: File,
  maxDimension: number,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

    const readAsDataUrl = () => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('READ_FAILED'));
      reader.readAsDataURL(file);
    };

    // Small SVGs pass through untouched (canvas would rasterize them).
    if (isSvg) {
      if (file.size > 300 * 1024) {
        reject(new Error('SVG_TOO_LARGE'));
        return;
      }
      readAsDataUrl();
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          readAsDataUrl();
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);

        // PNG keeps transparency (logos); JPEG/WEBP get lossy compression.
        const keepPng = file.type === 'image/png' || file.type === 'image/gif';
        const dataUrl = keepPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);

        // Final guard: never store anything that can blow the 5MB
        // localStorage quota or bloat the shared server database.
        if (dataUrl.length > 1.5 * 1024 * 1024) {
          const smaller = canvas.toDataURL('image/jpeg', 0.7);
          if (smaller.length > 1.5 * 1024 * 1024) {
            reject(new Error('IMAGE_TOO_LARGE'));
            return;
          }
          resolve(smaller);
          return;
        }
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('COMPRESS_FAILED'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    img.src = objectUrl;
  });
};
