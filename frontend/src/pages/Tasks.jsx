
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/authContext';
import { STATUSES, PRIORITIES, formatDate } from '../constants';
import { StatusBadge, PriorityBadge, RoleBadge } from '../components/Badges';

const TABS = [
  { key: 'all', label: 'All my tasks' },
  { key: 'created', label: 'Created by me' },
  { key: 'assigned', label: 'Assigned to me' },
];

export default function Tasks() {
  const { user } = useAuth();
  const [params] = useSearchParams();

  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    view: params.get('view') || 'all',
    search: '',
    status: params.get('status') || '',
    priority: params.get('priority') || '',
    assignee: '',
    dueFrom: '',
    dueTo: '',
    overdue: params.get('overdue') === 'true',
  });

  const setFilter = (name, value) => {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  // Load users for the assignee dropdown
  useEffect(() => {
    api.post('/users/list')
      .then((res) => {
        setUsers(res.data.users || []);
      })
      .catch((err) => {
        console.error('Failed to load users:', err);
      });
  }, []);

  // Fetch tasks whenever filters change
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const payload = {
          ...filters,
          overdue: filters.overdue,
        };

        // Remove empty optional filters, but preserve overdue as a boolean.
        Object.keys(payload).forEach((key) => {
          if (
            key !== 'overdue' &&
            (payload[key] === '' || payload[key] == null)
          ) {
            delete payload[key];
          }
        });

        console.log('Task list request:', payload);

        const res = await api.post('/tasks/list', payload);

        const fetchedTasks = res.data.tasks || [];

        console.log(
          'Fetched tasks:',
          fetchedTasks.map((task) => ({
            title: task.title,
            dueDate: task.dueDate,
            status: task.overallStatus,
            isOverdue: task.isOverdue,
          }))
        );

        setTasks(fetchedTasks);
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
        setError(
          err.response?.data?.message || 'Could not load tasks'
        );
        setTasks([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [filters]);

  const reset = () => {
    setFilters({
      view: 'all',
      search: '',
      status: '',
      priority: '',
      assignee: '',
      dueFrom: '',
      dueTo: '',
      overdue: false,
    });
  };

  return (
    <>
      <div className="page-head">
        <h1>My Tasks</h1>
        <Link className="btn btn--primary" to="/tasks/new">
          + New task
        </Link>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={filters.view === tab.key ? 'is-active' : ''}
            onClick={() => setFilter('view', tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          placeholder="Search by title…"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />

        <select
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={filters.priority}
          onChange={(e) => setFilter('priority', e.target.value)}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={filters.assignee}
          onChange={(e) => setFilter('assignee', e.target.value)}
        >
          <option value="">Any assignee</option>
          {users.map((item) => (
            <option key={item._id || item.id} value={item._id || item.id}>
              {String(item._id || item.id) === String(user?.id || user?._id)
                ? 'Me'
                : item.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          title="Due from"
          value={filters.dueFrom}
          onChange={(e) => setFilter('dueFrom', e.target.value)}
        />

        <input
          type="date"
          title="Due to"
          value={filters.dueTo}
          onChange={(e) => setFilter('dueTo', e.target.value)}
        />

        <label className="check">
          <input
            type="checkbox"
            checked={filters.overdue}
            onChange={(e) => setFilter('overdue', e.target.checked)}
          />
          Overdue only
        </label>

        <button
          className="btn btn--ghost btn--sm"
          onClick={reset}
        >
          Clear
        </button>
      </div>

      {error && <div className="form__error">{error}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Relation</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assignee</th>
              <th>Due</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="muted">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan="6" className="muted">
                  {filters.overdue
                    ? 'No overdue tasks found.'
                    : 'No tasks found.'}
                </td>
              </tr>
            )}

            {!loading &&
              tasks.map((task) => {
                const currentUserId = String(user?.id || user?._id || '');

                const assignedUser = task.assignedTo;

                const assignedUserId = String(
                  assignedUser?._id || assignedUser || ''
                );

                // Status belongs to the assigned user
                const assigneeStatus = (task.statuses || []).find(
                  (item) =>
                    String(item.user?._id || item.user || '') === assignedUserId
                )?.status;

                return (
                  <tr
                    key={task._id}
                    className={task.isOverdue ? 'is-overdue' : ''}
                  >
                    <td>
                      <Link to={`/tasks/${task._id}`}>
                        {task.title}
                      </Link>
                    </td>

                    <td>
                      <RoleBadge task={task} userId={currentUserId} />
                    </td>

                    {/* <td>
                     <StatusBadge
  status={
    task.statuses?.find(
      (item) =>
        String(item.user?._id || item.user) ===
        String(task.assignedTo?._id || task.assignedTo)
    )?.status ||
    task.overallStatus ||
    'Pending'
  }
/>
                    </td> */}

                    <td>
                      <StatusBadge
                        status={assigneeStatus || task.overallStatus || 'Open'}
                      />
                    </td>

                    <td>
                      <PriorityBadge priority={task.priority} />
                    </td>

                    <td>
                      {!assignedUser
                        ? 'Unassigned'
                        : assignedUserId === currentUserId
                          ? 'You'
                          : assignedUser?.name || 'Unknown user'}
                    </td>

                    <td>
                      {formatDate(task.dueDate)}{' '}
                      {task.isOverdue && (
                        <span className="badge badge--overdue">
                          Overdue
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}
