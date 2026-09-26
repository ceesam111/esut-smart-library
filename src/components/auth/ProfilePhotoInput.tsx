import { ChangeEvent } from 'react';

const MAX_PHOTO_BYTES = 150 * 1024;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const TARGET_EDGE = 320;

export const PROFILE_PHOTO_HINT =
  'Optional — JPG, PNG, or WebP. Photos over 150 KB are compressed automatically.';

export function validateProfilePhoto(file: File) {
  if (!file.type.startsWith('image/') || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return 'Please choose a JPG, PNG, or WebP image.';
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return `Photo is too large (${Math.round(file.size / 1024 / 1024)} MB). Please choose an image under 5 MB.`;
  }
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read selected image.')); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

async function compressToDataUrl(file: File): Promise<{ dataUrl: string; compressed: boolean }> {
  const img = await loadImage(file);
  const scale = Math.min(1, TARGET_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that photo.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, 0.92);
  let quality = 0.92;
  while (blob && blob.size > MAX_PHOTO_BYTES && quality > 0.35) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, quality);
  }

  if (!blob) throw new Error('Could not process that photo.');
  const compressed = blob.size < file.size;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read selected image.'));
    reader.readAsDataURL(blob);
  });
  return { dataUrl, compressed };
}

export async function readProfilePhoto(file: File): Promise<string> {
  const error = validateProfilePhoto(file);
  if (error) throw new Error(error);

  if (file.size <= MAX_PHOTO_BYTES) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read selected image.'));
      reader.readAsDataURL(file);
    });
  }

  try {
    const { dataUrl } = await compressToDataUrl(file);
    return dataUrl;
  } catch {
    // Older/unsupported canvas paths fall back to the raw file if it is
    // small enough, otherwise surface a friendly error.
    if (file.size <= MAX_PHOTO_BYTES) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read selected image.'));
        reader.readAsDataURL(file);
      });
    }
    throw new Error('Could not compress that photo. Please choose a smaller image.');
  }
}

export default function ProfilePhotoInput({
  value,
  onChange,
  onError,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  onError: (message: string) => void;
}) {
  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      onChange(await readProfilePhoto(file));
      onError('');
    } catch (error) {
      event.target.value = '';
      onChange(null);
      onError(error instanceof Error ? error.message : 'Could not process that photo.');
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-white border border-neutral-200 overflow-hidden flex items-center justify-center text-neutral-400 text-xl shrink-0">
          {value ? <img src={value} alt="Selected profile" className="w-full h-full object-cover" /> : '👤'}
        </div>
        <div className="flex-1">
          <label className="label">
            Profile Photo <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100" />
          <p className="text-xs text-neutral-400 mt-1">{PROFILE_PHOTO_HINT}</p>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); onError(''); }}
              className="mt-2 text-xs font-semibold text-primary-700 hover:underline"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
