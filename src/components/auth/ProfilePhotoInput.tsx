import { ChangeEvent } from 'react';

const MAX_PHOTO_BYTES = 150 * 1024;

export const PROFILE_PHOTO_HINT = 'JPG, PNG, or WebP. Maximum file size is 150 KB.';

export function validateProfilePhoto(file: File) {
  if (!file.type.startsWith('image/') || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return 'Please choose a JPG, PNG, or WebP image.';
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `Photo is too large (${Math.round(file.size / 1024)} KB). Maximum size is 150 KB.`;
  }
  return null;
}

export function readProfilePhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const error = validateProfilePhoto(file);
    if (error) return reject(new Error(error));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read selected image.'));
    reader.readAsDataURL(file);
  });
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
          <label className="label">Profile Photo</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100" />
          <p className="text-xs text-neutral-400 mt-1">{PROFILE_PHOTO_HINT}</p>
        </div>
      </div>
    </div>
  );
}
