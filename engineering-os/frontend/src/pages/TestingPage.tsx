import { useCallback, useEffect, useState } from 'react'
import { api, type TestRecord } from '../api/client'

const EMPTY: Partial<TestRecord> = {
  test_name: '',
  test_date: new Date().toISOString().slice(0, 10),
  result: '',
  pass_fail: 'pending',
  observations: '',
  issues_found: '',
}

function badgeClass(pf: string) {
  if (pf === 'pass') return 'badge badge-pass'
  if (pf === 'fail') return 'badge badge-fail'
  return 'badge badge-pending'
}

export default function TestingPage() {
  const [tests, setTests] = useState<TestRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<TestRecord>>(EMPTY)

  const load = useCallback(async () => {
    setTests(await api.tests.list())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.test_name?.trim()) return
    await api.tests.create(form)
    setForm({ ...EMPTY, test_date: new Date().toISOString().slice(0, 10) })
    setShowForm(false)
    load()
  }

  async function remove(id: number) {
    if (!confirm('Delete this test record?')) return
    await api.tests.delete(id)
    load()
  }

  return (
    <div>
      <header className="page-header">
        <h2>Testing</h2>
        <p>Test history with pass/fail tracking and observations</p>
      </header>

      <div className="toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          Log Test
        </button>
      </div>

      {tests.length === 0 ? (
        <p className="empty-state">No tests logged yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Test Name</th>
                <th>Date</th>
                <th>Result</th>
                <th>Pass/Fail</th>
                <th>Observations</th>
                <th>Issues Found</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td>{t.test_name}</td>
                  <td>{t.test_date}</td>
                  <td>{t.result || '—'}</td>
                  <td>
                    <span className={badgeClass(t.pass_fail)}>{t.pass_fail}</span>
                  </td>
                  <td style={{ maxWidth: 180 }}>{t.observations || '—'}</td>
                  <td style={{ maxWidth: 180 }}>{t.issues_found || '—'}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(t.id)}>
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
            <h3>Log Test</h3>
            <form onSubmit={submit}>
              <div className="form-group">
                <label>Test Name</label>
                <input
                  value={form.test_name || ''}
                  onChange={(e) => setForm((f) => ({ ...f, test_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={form.test_date || ''}
                  onChange={(e) => setForm((f) => ({ ...f, test_date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Result</label>
                <input
                  value={form.result || ''}
                  onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Pass / Fail</label>
                <select
                  value={form.pass_fail || 'pending'}
                  onChange={(e) => setForm((f) => ({ ...f, pass_fail: e.target.value }))}
                >
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="form-group">
                <label>Observations</label>
                <textarea
                  value={form.observations || ''}
                  onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Issues Found</label>
                <textarea
                  value={form.issues_found || ''}
                  onChange={(e) => setForm((f) => ({ ...f, issues_found: e.target.value }))}
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
