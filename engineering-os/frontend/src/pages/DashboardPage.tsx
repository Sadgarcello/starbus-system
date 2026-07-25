import { useCallback, useEffect, useState } from 'react'
import { api, type Task } from '../api/client'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.dashboard>> | null>(null)
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.dashboard())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTask.trim()) return
    await api.tasks.create(newTask.trim())
    setNewTask('')
    load()
  }

  async function toggleTask(task: Task) {
    await api.tasks.toggle(task.id, !task.completed)
    load()
  }

  async function removeTask(id: number) {
    await api.tasks.delete(id)
    load()
  }

  if (loading || !data) {
    return (
      <div>
        <header className="page-header">
          <h2>Dashboard</h2>
        </header>
        <p className="save-indicator">Loading…</p>
      </div>
    )
  }

  const { project, progress_percent, active_tasks, completed_tasks, tasks } = data

  return (
    <div>
      <header className="page-header">
        <h2>Dashboard</h2>
        <p>Project status at a glance</p>
      </header>

      <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <label>Project</label>
          <div className="value" style={{ fontSize: '1rem' }}>
            {project.name}
          </div>
        </div>
        <div className="stat-card">
          <label>Status</label>
          <div className="value" style={{ fontSize: '1rem', textTransform: 'capitalize' }}>
            {project.status}
          </div>
        </div>
        <div className="stat-card">
          <label>Version</label>
          <div className="value">{project.version}</div>
        </div>
        <div className="stat-card">
          <label>Last Update</label>
          <div className="value" style={{ fontSize: '0.95rem' }}>
            {formatDate(project.last_update)}
          </div>
        </div>
        <div className="stat-card">
          <label>Active Tasks</label>
          <div className="value">{active_tasks}</div>
        </div>
        <div className="stat-card">
          <label>Completed Tasks</label>
          <div className="value">{completed_tasks}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Progress — {progress_percent}%
        </label>
        <div className="progress-bar" style={{ marginTop: '0.5rem' }}>
          <div className="progress-bar-fill" style={{ width: `${progress_percent}%` }} />
        </div>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Derived from task completion when tasks exist; otherwise uses stored project progress.
        </p>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Tasks</h3>
        {tasks.length === 0 ? (
          <p className="empty-state" style={{ padding: '1.5rem' }}>
            No tasks yet. Add one below to track progress.
          </p>
        ) : (
          <ul className="task-list">
            {tasks.map((t) => (
              <li key={t.id}>
                <input
                  type="checkbox"
                  checked={!!t.completed}
                  onChange={() => toggleTask(t)}
                />
                <span className={t.completed ? 'done' : ''}>{t.title}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => removeTask(t.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addTask} className="toolbar" style={{ marginTop: '1rem', marginBottom: 0 }}>
          <input
            type="text"
            placeholder="New task…"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">
            Add Task
          </button>
        </form>
      </div>
    </div>
  )
}
