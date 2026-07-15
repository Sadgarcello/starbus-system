import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';

async function compressImage(file: File, maxEdge = 512, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('Could not compress image');
  return blob;
}

export const avatarService = {
  pathFor(userId: string) {
    return `${userId}/avatar.jpg`;
  },

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const blob = await compressImage(file);
    const path = this.pathFor(userId);

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });
    if (uploadError) throw uploadError;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar: path })
      .eq('id', userId);
    if (profileError) throw profileError;

    return path;
  },

  async getSignedUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data.signedUrl;
  },
};
