import { useCallback, useEffect, useState } from 'react'
import { api, type Component } from '../api/client'

const EMPTY: Partial<Component> = {
  name: '',
  category: '',
  quantity: 1,
  cost: 0,
  specifications: '',
  purpose: '',
  notes: '',
}

export default function ComponentsPage() {
  const [items, setItems] = useState<Component[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<Component>>(EMPTY)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const res = await api.components.list(q)
      setItems(res.items)
      setTotalCost(res.total_cost)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), 300)
    return () => clearTimeout(t)
  }, [search, load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) return
    await api.components.create(form)
    setForm(EMPTY)
    setShowForm(false)
    load(search || undefined)
  }

  async function remove(id: number) {
    if (!confirm('Delete this component?')) return
    await api.components.delete(id)
    load(search || undefined)
  }

  return (
    <div>
      <header className="page-header">
        <h2>Components Database</h2>
        <p>Bill of materials — searchable with auto-calculated total cost</p>
      </header>

      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Search name, category, specs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="stat-card" style={{ padding: '0.5rem 1rem' }}>
          <label>Total Project Cost</label>
          <div className="value">${totalCost.toFixed(2)}</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          Add Component
        </button>
      </div>

      {loading ? (
        <p className="save-indicator">Loading…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">No components yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Line Total</th>
                <th>Specifications</th>
                <th>Purpose</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.category || '—'}</td>
                  <td>{c.quantity}</td>
                  <td>${c.cost.toFixed(2)}</td>
                  <td>${(c.quantity * c.cost).toFixed(2)}</td>
                  <td style={{ maxWidth: 160 }}>{c.specifications || '—'}</td>
                  <td style={{ maxWidth: 140 }}>{c.purpose || '—'}</td>
                  <td style={{ maxWidth: 120 }}>{c.notes || '—'}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(c.id)}>
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Component</h3>
            <form onSubmit={submit}>
              {(
                [
                  ['name', 'Name', 'text'],
                  ['category', 'Category', 'text'],
                  ['quantity', 'Quantity', 'number'],
                  ['cost', 'Unit Cost ($)', 'number'],
                  ['specifications', 'Specifications', 'text'],
                  ['purpose', 'Purpose', 'text'],
                  ['notes', 'Notes', 'text'],
                ] as const
              ).map(([key, label, type]) => (
                <div className="form-group" key={key}>
                  <label>{label}</label>
                  <input
                    type={type}
                    step={type === 'number' ? 'any' : undefined}
                    value={String(form[key] ?? '')}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                      }))
                    }
                    required={key === 'name'}
                  />
                </div>
              ))}
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
