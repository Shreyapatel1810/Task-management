
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/authContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.post('/tasks/stats', {})
      .then((res) => setStats(res.data.stats))
      .catch(() => setError('Could not load dashboard'));
  }, []);

  const cards = stats && [
    {
      label: 'Created by me',
      value: stats.created,
      to: '/tasks?view=created',
    },
    {
      label: 'Assigned to me',
      value: stats.assigned,
      to: '/tasks?view=assigned',
    },
    {
      label: 'In progress',
      value: stats.inProgress,
      to: '/tasks?status=In%20Progress',
    },
    {
      label: 'Completed',
      value: stats.completed,
      to: '/tasks?status=Completed',
    },
    {
      label: 'Overdue',
      value: stats.overdue,
      to: '/tasks?overdue=true',
      danger: stats.overdue > 0,
    },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Hello, {user?.name} 👋</h1>

        <Link className="btn btn--primary" to="/tasks/new">
          + New task
        </Link>
      </div>

      {error && <div className="form__error">{error}</div>}

      {!stats && !error && <p className="muted">Loading…</p>}

      {cards && (
        <div className="stats">
          {cards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className={`stat ${card.danger ? 'stat--danger' : ''}`}
            >
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
