/**
 * REST client — all backend communication goes through here.
 * Vite dev server proxies /api → Flask :5000.
 */

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  dashboard: () =>
    request<{
      project: Project
      progress_percent: number
      active_tasks: number
      completed_tasks: number
      tasks: Task[]
    }>('/dashboard'),

  updateProject: (data: Partial<Project>) =>
    request<Project>('/project', { method: 'PATCH', body: JSON.stringify(data) }),

  overview: {
    get: () => request<Overview>('/overview'),
    save: (data: Partial<Overview>) =>
      request<Overview>('/overview', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  components: {
    list: (q?: string) =>
      request<{ items: Component[]; total_cost: number }>(
        `/components${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      ),
    create: (data: Partial<Component>) =>
      request<Component>('/components', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Component>) =>
      request<Component>(`/components/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/components/${id}`, { method: 'DELETE' }),
  },

  circuits: {
    list: () => request<{ items: CircuitImage[] }>('/circuits'),
    upload: (file: File, caption?: string) => {
      const form = new FormData()
      form.append('file', file)
      if (caption) form.append('caption', caption)
      return fetch(`${BASE}/circuits`, { method: 'POST', body: form }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json() as Promise<CircuitImage>
      })
    },
    update: (id: number, caption: string) =>
      request<CircuitImage>(`/circuits/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption }),
      }),
    delete: (id: number) => request(`/circuits/${id}`, { method: 'DELETE' }),
  },

  tests: {
    list: () => request<TestRecord[]>('/tests'),
    create: (data: Partial<TestRecord>) =>
      request<TestRecord>('/tests', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<TestRecord>) =>
      request<TestRecord>(`/tests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/tests/${id}`, { method: 'DELETE' }),
  },

  problems: {
    list: () => request<Problem[]>('/problems'),
    create: (data: Partial<Problem>) =>
      request<Problem>('/problems', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Problem>) =>
      request<Problem>(`/problems/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/problems/${id}`, { method: 'DELETE' }),
  },

  milestones: {
    list: () => request<Milestone[]>('/milestones'),
    create: (data: Partial<Milestone>) =>
      request<Milestone>('/milestones', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Milestone>) =>
      request<Milestone>(`/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/milestones/${id}`, { method: 'DELETE' }),
  },

  notes: {
    list: () => request<Note[]>('/notes'),
    create: (content: string) =>
      request<Note>('/notes', { method: 'POST', body: JSON.stringify({ content }) }),
    update: (id: number, content: string) =>
      request<Note>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
    delete: (id: number) => request(`/notes/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    create: (title: string) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify({ title }) }),
    toggle: (id: number, completed: boolean) =>
      request<Task>(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed }),
      }),
    delete: (id: number) => request(`/tasks/${id}`, { method: 'DELETE' }),
  },
}

export interface Project {
  id: number
  name: string
  status: string
  version: string
  last_update: string | null
  progress_percent: number
}

export interface Task {
  id: number
  title: string
  completed: number
}

export interface Overview {
  id: number
  project_id: number
  title: string
  problem_statement: string
  objective: string
  expected_outcome: string
  future_upgrades: string
  lessons_learned: string
  updated_at: string | null
}

export interface Component {
  id: number
  name: string
  category: string
  quantity: number
  cost: number
  specifications: string
  purpose: string
  notes: string
}

export interface CircuitImage {
  id: number
  filename: string
  original_name: string
  caption: string
  url: string
  uploaded_at: string
}

export interface TestRecord {
  id: number
  test_name: string
  test_date: string
  result: string
  pass_fail: string
  observations: string
  issues_found: string
}

export interface Problem {
  id: number
  problem: string
  cause: string
  solution: string
  status: string
}

export interface Milestone {
  id: number
  title: string
  description: string
  milestone_date: string
  sort_order: number
}

export interface Note {
  id: number
  content: string
  created_at: string
  updated_at: string | null
}
