import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/overview', label: 'Overview' },
  { to: '/components', label: 'Components' },
  { to: '/circuits', label: 'Circuits' },
  { to: '/testing', label: 'Testing' },
  { to: '/problems', label: 'Problems' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/notes', label: 'Notes' },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>Local workspace</span>
          <h1>Engineering OS</h1>
        </div>
        <nav>
          <ul className="nav-links">
            {NAV.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink to={to} end={end}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
