import { supabase } from '@/lib/supabase';
import type { ReadingBook, ReadingBookVoter } from '@/types';

const BUCKET = 'reading-covers';

async function compressCover(file: File, maxEdge = 720, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
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

export function readingProgressPercent(book: Pick<ReadingBook, 'total_pages' | 'pages_finished'>) {
  if (!book.total_pages || book.total_pages <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((book.pages_finished / book.total_pages) * 100)),
  );
}

export const readingService = {
  async listBooks(): Promise<ReadingBook[]> {
    const { data, error } = await supabase
      .from('reading_books')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ReadingBook[];
  },

  async createBook(input: {
    title: string;
    author?: string;
    totalPages: number;
    pagesFinished?: number;
    coverFile?: File | null;
    createdBy: string;
  }): Promise<ReadingBook> {
    const title = input.title.trim();
    if (title.length < 1) throw new Error('Title is required');
    if (!input.totalPages || input.totalPages < 1) throw new Error('Total pages must be at least 1');

    const pagesFinished = Math.max(0, Math.min(input.totalPages, input.pagesFinished ?? 0));

    const { data, error } = await supabase
      .from('reading_books')
      .insert({
        title,
        author: input.author?.trim() || null,
        total_pages: input.totalPages,
        pages_finished: pagesFinished,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    if (error) throw error;

    let book = data as ReadingBook;

    if (input.coverFile) {
      const path = await this.uploadCover(book.id, input.coverFile);
      const { data: updated, error: upErr } = await supabase
        .from('reading_books')
        .update({ cover_path: path, updated_at: new Date().toISOString() })
        .eq('id', book.id)
        .select('*')
        .single();
      if (upErr) throw upErr;
      book = updated as ReadingBook;
    }

    return book;
  },

  async updateProgress(
    bookId: string,
    pagesFinished: number,
    totalPages?: number,
    sessionDate?: string,
  ): Promise<{ book: ReadingBook; attendeesUpdated: number }> {
    const patch: Record<string, unknown> = {
      pages_finished: pagesFinished,
      updated_at: new Date().toISOString(),
    };
    if (totalPages != null) patch.total_pages = totalPages;

    const { data, error } = await supabase
      .from('reading_books')
      .update(patch)
      .eq('id', bookId)
      .select('*')
      .single();
    if (error) throw error;

    const book = data as ReadingBook;
    const date =
      sessionDate ??
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

    const { data: count, error: applyError } = await supabase.rpc(
      'apply_reading_progress_to_attendees',
      {
        p_book_id: bookId,
        p_session_date: date,
      },
    );
    if (applyError) throw applyError;

    return { book, attendeesUpdated: Number(count ?? 0) };
  },

  async deleteBook(bookId: string): Promise<void> {
    const { error } = await supabase.from('reading_books').delete().eq('id', bookId);
    if (error) throw error;
  },

  async uploadCover(bookId: string, file: File): Promise<string> {
    const blob = await compressCover(file);
    const path = `${bookId}/cover.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });
    if (error) throw error;

    const { error: upErr } = await supabase
      .from('reading_books')
      .update({ cover_path: path, updated_at: new Date().toISOString() })
      .eq('id', bookId);
    if (upErr) throw upErr;

    return path;
  },

  async getCoverUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data.signedUrl;
  },

  async listVotes(): Promise<ReadingBookVoter[]> {
    const { data, error } = await supabase
      .from('reading_book_votes')
      .select('student_id, book_id, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const studentIds = [...new Set(rows.map((r) => r.student_id as string))];
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, profile:profiles!students_user_id_fkey(id, email, name, avatar)')
      .in('id', studentIds);
    if (studentError) throw studentError;

    const byId = new Map(
      (students ?? []).map((s) => {
        const row = s as unknown as {
          id: string;
          profile: { name: string | null; email: string; avatar: string | null } | null;
        };
        return [row.id, row.profile];
      }),
    );

    return rows.map((r) => {
      const profile = byId.get(r.student_id as string);
      return {
        student_id: r.student_id as string,
        book_id: r.book_id as string,
        name: profile?.name ?? null,
        email: profile?.email ?? '',
        avatar: profile?.avatar ?? null,
      };
    });
  },

  async vote(bookId: string): Promise<void> {
    const { error } = await supabase.rpc('vote_reading_book', { p_book_id: bookId });
    if (error) throw error;
  },

  async clearVote(): Promise<void> {
    const { error } = await supabase.rpc('clear_reading_vote');
    if (error) throw error;
  },
};
