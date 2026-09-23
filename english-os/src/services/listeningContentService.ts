import { supabase } from '@/lib/supabase';

const AUDIO_BUCKET = 'listening-audio';
const SPEAKER_BUCKET = 'listening-speakers';

export async function uploadListeningAudio(stimulusId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp3';
  const path = `${stimulusId}/audio.${ext}`;
  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'audio/mpeg',
  });
  if (error) throw error;
  return path;
}

export async function uploadSpeakerImage(stimulusId: string, index: number, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${stimulusId}/speaker-${index}.${ext}`;
  const { error } = await supabase.storage.from(SPEAKER_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw error;
  return path;
}

export async function getTeacherAudioSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not load audio');
  return data.signedUrl;
}
