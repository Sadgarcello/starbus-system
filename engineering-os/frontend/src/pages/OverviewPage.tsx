import { useCallback, useEffect, useState } from 'react'
import { api, type Overview } from '../api/client'
import { useDebouncedSave } from '../hooks/useDebouncedSave'

const FIELDS: { key: keyof Overview; label: string; rows?: number }[] = [
  { key: 'title', label: 'Title' },
  { key: 'problem_statement', label: 'Problem Statement', rows: 4 },
  { key: 'objective', label: 'Objective', rows: 3 },
  { key: 'expected_outcome', label: 'Expected Outcome', rows: 3 },
  { key: 'future_upgrades', label: 'Future Upgrades', rows: 3 },
  { key: 'lessons_learned', label: 'Lessons Learned', rows: 3 },
]

const EMPTY: Overview = {
  id: 0,
  project_id: 1,
  title: '',
  problem_statement: '',
  objective: '',
  expected_outcome: '',
  future_upgrades: '',
  lessons_learned: '',
  updated_at: null,
}

export default function OverviewPage() {
  const [form, setForm] = useState<Overview>(EMPTY)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.overview.get().then(setForm).finally(() => setLoading(false))
  }, [])

  const save = useCallback(async (data: Overview) => {
    const { id: _id, project_id: _pid, updated_at: _ua, ...payload } = data
    await api.overview.save(payload)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [])

  useDebouncedSave(form, save)

  function update(key: keyof Overview, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  if (loading) {
    return (
      <div>
        <header className="page-header">
          <h2>Project Overview</h2>
        </header>
        <p className="save-indicator">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h2>Project Overview</h2>
        <p>
          Narrative fields auto-save as you type.{' '}
          <span className={`save-indicator ${saved ? 'saved' : ''}`}>
            {saved ? 'Saved' : 'Editing…'}
          </span>
        </p>
      </header>

      <div className="card">
        {FIELDS.map(({ key, label, rows }) => (
          <div className="form-group" key={key}>
            <label htmlFor={key}>{label}</label>
            {rows ? (
              <textarea
                id={key}
                value={(form[key] as string) || ''}
                onChange={(e) => update(key, e.target.value)}
                rows={rows}
              />
            ) : (
              <input
                id={key}
                type="text"
                value={(form[key] as string) || ''}
                onChange={(e) => update(key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
