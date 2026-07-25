import { useCallback, useEffect, useState } from 'react'
import { api, type Note } from '../api/client'
import { useDebouncedSave } from '../hooks/useDebouncedSave'

function NoteEditor({ note, onRemove }: { note: Note; onRemove: () => void }) {
  const [content, setContent] = useState(note.content)
  const [saved, setSaved] = useState(false)

  const save = useCallback(
    async (text: string) => {
      await api.notes.update(note.id, text)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    },
    [note.id],
  )

  useDebouncedSave(content, save)

  return (
    <div className="note-item">
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className={`save-indicator ${saved ? 'saved' : ''}`}>
          {saved ? 'Saved' : note.updated_at ? `Updated ${note.updated_at.slice(0, 10)}` : ''}
        </span>
        <button type="button" className="btn btn-sm btn-danger" onClick={onRemove}>
          Delete
        </button>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setNotes(await api.notes.list())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addNote() {
    const note = await api.notes.create('')
    setNotes((n) => [note, ...n])
  }

  async function remove(id: number) {
    await api.notes.delete(id)
    setNotes((n) => n.filter((x) => x.id !== id))
  }

  return (
    <div>
      <header className="page-header">
        <h2>Notes</h2>
        <p>Quick ideas and future improvements — auto-saved on edit</p>
      </header>

      <div className="toolbar">
        <button type="button" className="btn btn-primary" onClick={addNote}>
          New Note
        </button>
      </div>

      {loading ? (
        <p className="save-indicator">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="empty-state">
          No notes yet. Click &quot;New Note&quot; to capture an idea.
        </p>
      ) : (
        <div className="note-list">
          {notes.map((n) => (
            <NoteEditor key={n.id} note={n} onRemove={() => remove(n.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
