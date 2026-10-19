import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/authContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">✓ TaskFlow</div>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/tasks">My Tasks</NavLink>
        </nav>
        <div className="topbar__user">
          <span>{user?.name}</span>
          <button className="btn btn--ghost btn--sm" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="app__content">
        <Outlet />
      </main>
    </div>
  );
}