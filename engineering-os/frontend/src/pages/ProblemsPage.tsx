import { useCallback, useEffect, useState } from 'react'
import { api, type Problem } from '../api/client'

const EMPTY: Partial<Problem> = {
  problem: '',
  cause: '',
  solution: '',
  status: 'open',
}

function statusBadge(status: string) {
  if (status === 'resolved') return 'badge badge-resolved'
  if (status === 'in-progress') return 'badge badge-in-progress'
  return 'badge badge-open'
}

export default function ProblemsPage() {
  const [items, setItems] = useState<Problem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<Problem>>(EMPTY)

  const load = useCallback(async () => {
    setItems(await api.problems.list())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.problem?.trim()) return
    await api.problems.create(form)
    setForm(EMPTY)
    setShowForm(false)
    load()
  }

  async function remove(id: number) {
    if (!confirm('Delete this entry?')) return
    await api.problems.delete(id)
    load()
  }

  return (
    <div>
      <header className="page-header">
        <h2>Problems &amp; Solutions</h2>
        <p>Engineering log — problem, cause, solution, status</p>
      </header>

      <div className="toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          Add Entry
        </button>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">No problems logged yet.</p>
      ) : (
        <div className="problem-cards">
          {items.map((p) => (
            <article className="problem-card" key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <h4>{p.problem}</h4>
                <span className={statusBadge(p.status)}>{p.status}</span>
              </div>
              <dl>
                <dt>Cause</dt>
                <dd>{p.cause || '—'}</dd>
                <dt>Solution</dt>
                <dd>{p.solution || '—'}</dd>
              </dl>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(p.id)}>
                Delete
              </button>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Problem Entry</h3>
            <form onSubmit={submit}>
              <div className="form-group">
                <label>Problem</label>
                <textarea
                  value={form.problem || ''}
                  onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Cause</label>
                <textarea
                  value={form.cause || ''}
                  onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Solution</label>
                <textarea
                  value={form.solution || ''}
                  onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={form.status || 'open'}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
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
