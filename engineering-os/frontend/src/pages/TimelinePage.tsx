import { useCallback, useEffect, useState } from 'react'
import { api, type Milestone } from '../api/client'

const EMPTY: Partial<Milestone> = {
  title: '',
  description: '',
  milestone_date: new Date().toISOString().slice(0, 10),
  sort_order: 0,
}

export default function TimelinePage() {
  const [items, setItems] = useState<Milestone[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<Milestone>>(EMPTY)

  const load = useCallback(async () => {
    setItems(await api.milestones.list())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title?.trim()) return
    await api.milestones.create(form)
    setForm({ ...EMPTY, milestone_date: new Date().toISOString().slice(0, 10) })
    setShowForm(false)
    load()
  }

  async function remove(id: number) {
    if (!confirm('Delete this milestone?')) return
    await api.milestones.delete(id)
    load()
  }

  return (
    <div>
      <header className="page-header">
        <h2>Progress Timeline</h2>
        <p>Major milestones in chronological order</p>
      </header>

      <div className="toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          Add Milestone
        </button>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">No milestones yet.</p>
      ) : (
        <div className="timeline">
          {items.map((m) => (
            <article className="timeline-item" key={m.id}>
              <div className="timeline-date">{m.milestone_date}</div>
              <h4 style={{ margin: '0 0 0.35rem' }}>{m.title}</h4>
              {m.description && (
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {m.description}
                </p>
              )}
              <button
                type="button"
                className="btn btn-sm btn-danger"
                style={{ marginTop: '0.75rem' }}
                onClick={() => remove(m.id)}
              >
                Delete
              </button>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Milestone</h3>
            <form onSubmit={submit}>
              <div className="form-group">
                <label>Title</label>
                <input
                  value={form.title || ''}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={form.milestone_date || ''}
                  onChange={(e) => setForm((f) => ({ ...f, milestone_date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="btn-row">
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
