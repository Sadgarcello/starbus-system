import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type CircuitImage } from '../api/client'

export default function CircuitsPage() {
  const [items, setItems] = useState<CircuitImage[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await api.circuits.list()
    setItems(res.items)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await api.circuits.upload(file)
      load()
    } catch (err) {
      alert(String(err))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this image?')) return
    await api.circuits.delete(id)
    load()
  }

  const isPdf = (name: string) => name.toLowerCase().endsWith('.pdf')

  return (
    <div>
      <header className="page-header">
        <h2>Circuit Gallery</h2>
        <p>Schematics, wiring diagrams, and prototype photos (stored locally)</p>
      </header>

      <div className="toolbar">
        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={onUpload} />
        {uploading && <span className="save-indicator">Uploading…</span>}
      </div>

      {items.length === 0 ? (
        <p className="empty-state">No images uploaded yet.</p>
      ) : (
        <div className="gallery">
          {items.map((img) => (
            <div className="gallery-item" key={img.id}>
              {isPdf(img.original_name) ? (
                <div
                  style={{
                    height: 160,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-primary)',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.8rem',
                  }}
                >
                  PDF — {img.original_name}
                </div>
              ) : (
                <img src={img.url} alt={img.original_name} loading="lazy" />
              )}
              <div className="caption">
                <strong>{img.original_name}</strong>
                {img.caption && <p style={{ margin: '0.25rem 0 0' }}>{img.caption}</p>}
                <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                  <a href={img.url} target="_blank" rel="noreferrer" className="btn btn-sm">
                    Open
                  </a>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(img.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
