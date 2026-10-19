
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/authContext';

const ASSIGNEE_STATUSES = [
  'Open',
  'In Progress',
  'In Review',
];

export default function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const userId = String(user?.id || user?._id || '');

  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [newAssignee, setNewAssignee] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Get an ID whether the value is populated or just an ObjectId.
  const getId = (value) =>
    String(value?._id || value?.id || value || '');

  // Load task details.
  const fetchTask = useCallback(async () => {
    try {
      const response = await api.post('/tasks/details', { id });
      const result = response.data?.task ?? response.data;

      setTask(result);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to load task details'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Load users for reassignment.
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.post('/users/list', {});
        const result = response.data?.users ?? response.data;

        setUsers(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    };

    fetchUsers();
  }, []);

  if (loading) {
    return <div className="page-loader">Loading task...</div>;
  }

  if (!task) {
    return (
      <div className="app__content">
        <div className="alert alert--danger">
          {error || 'Task not found.'}
        </div>
        <Link to="/tasks" className="btn btn--ghost">
          Back to Tasks
        </Link>
      </div>
    );
  }

  const creatorId = getId(task.createdBy);
  const assigneeId = getId(task.assignedTo);

  const isCreator = userId !== '' && userId === creatorId;
  const isAssignee = userId !== '' && userId === assigneeId;

  // Always use the assigned user's status as the task status.
  const statusRecord = (task.statuses || []).find(
    (item) => getId(item.user) === assigneeId
  );

  const currentStatus = statusRecord?.status || 'Open';
  const canModifyTask = currentStatus === 'Open';

  const isCompleted = currentStatus === 'Completed';
  const isReadOnly = isCompleted;

  const canPutOnHold = currentStatus === 'In Progress';
  const canReopen = currentStatus === 'On Hold';
  const canComplete = currentStatus === 'In Review';
  const isLocked = currentStatus === 'On Hold';

  // Refresh task details after an action.
  const refreshTask = async () => {
    const response = await api.post('/tasks/details', { id });
    const result = response.data?.task ?? response.data;

    setTask(result);
  };

  // Update status.
  const changeStatus = async (status) => {
    if (saving) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');

      await api.post('/tasks/update-status', {
        id: task._id || id,
        status,
      });

      await refreshTask();

      setMessage('Task status updated successfully.');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to update task status'
      );
    } finally {
      setSaving(false);
    }
  };

  // Creator dropdown: Reopen means In Progress.
  const handleCreatorStatusChange = (event) => {
    const selectedStatus = event.target.value;

    if (!selectedStatus) return;

    const statusToSend =
      selectedStatus === 'Reopen'
        ? 'In Progress'
        : selectedStatus;

    changeStatus(statusToSend);
  };

  // Assignee can select only allowed statuses.
  const handleAssigneeStatusChange = (event) => {
    const selectedStatus = event.target.value;

    if (!selectedStatus) return;

    changeStatus(selectedStatus);
  };

  // Reassign only when current status is Open.
  const reassign = async () => {
    if (saving) return;

    if (currentStatus !== 'Open') {
      setError('You can reassign a task only when its status is Open.');
      return;
    }

    if (!newAssignee) {
      setError('Please select one user.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      await api.post('/tasks/assign', {
        id: task._id || id,
        assignedTo: newAssignee,
      });

      setNewAssignee('');
      await refreshTask();

      setMessage('Task reassigned successfully.');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to reassign task'
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete task. Change this URL if your backend uses a different route.
  const deleteTask = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this task?'
    );

    if (!confirmed || saving) return;

    try {
      setSaving(true);
      setError('');

      await api.post('/tasks/delete', { id: task._id || id });

      navigate('/tasks');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to delete task'
      );
      setSaving(false);
    }
  };

  // Build a download URL for a task attachment, if present.
  const attachment = task.attachment || task.file || task.attachments;
  const attachmentUrl =
    typeof attachment === 'string'
      ? attachment
      : attachment?.url || attachment?.path;

  const attachmentName =
    attachment?.originalname ||
    attachment?.filename ||
    attachment?.name ||
    (typeof attachment === 'string'
      ? attachment.split('/').pop()
      : 'Download attachment');

  return (
    <div className="app__content">
      <div className="page-head">
        <h1>Task Details</h1>

        <div className="page-head__actions">
          <Link to="/tasks" className="btn btn--ghost">
            Back
          </Link>

          {isCreator && canModifyTask && (
            <Link
  
              to={`/tasks/${task._id || id}/edit`}
              className="btn btn--primary"
            >
              Edit Task
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="task-message task-message--success" role="status">
          {message}
        </div>
      )}

      <div className="details">
        {/* Main task information */}
        <section className="card">
          <h3>{task.title || 'Untitled Task'}</h3>

          <p className="muted">Description</p>
          <p className="pre">
            {task.description || 'No description provided.'}
          </p>

          <h3>Task Information</h3>

          <dl className="meta">
            <dt>Relation</dt>
            <dd>
              {isCreator
                ? 'Created by you'
                : isAssignee
                  ? 'Assigned to you'
                  : 'Task'}
            </dd>

            <dt>Status</dt>
            <dd>
              <span
                className={`badge ${currentStatus === 'In Progress'
                    ? 'badge--status-in-progress'
                    : currentStatus === 'On Hold'
                      ? 'badge--status-on-hold'
                      : currentStatus === 'In Review'
                        ? 'badge--status-in-review'
                        : currentStatus === 'Completed'
                          ? 'badge--status-completed'
                          : ''
                  }`}
              >
                {currentStatus}
              </span>
            </dd>

            <dt>Priority</dt>
            <dd>{task.priority || 'Not specified'}</dd>

            <dt>Due Date</dt>
            <dd>
              {task.dueDate
                ? new Date(task.dueDate).toLocaleDateString()
                : 'No due date'}
            </dd>

            <dt>Created By</dt>
            <dd>
              {task.createdBy?.name ||
                task.createdBy?.email ||
                'Unknown'}
            </dd>

            <dt>Assigned To</dt>
            <dd>
              {task.assignedTo?.name ||
                task.assignedTo?.email ||
                'Unassigned'}
            </dd>

            {attachmentUrl && (
              <>
                <dt>Attachment</dt>
                <dd>
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={attachmentName}
                  >
                    {attachmentName}
                  </a>
                </dd>
              </>
            )}
          </dl>
        </section>

        {/* Actions panel */}
        <aside className="card">
          {/* Creator status dropdown */}
          {isCreator && (
            <>
              <h3>Manage Task Status</h3>

              <div className="status-control">
                <label htmlFor="creator-status">
                  Update Status
                </label>

                <select
                  id="creator-status"
                  value=""
                  onChange={handleCreatorStatusChange}
                  disabled={saving || isReadOnly}
                >
                  <option value="" disabled>
                    Select status
                  </option>

                  {canPutOnHold && (
                    <option value="On Hold">On Hold</option>
                  )}

                  {canReopen && (
                    <option value="Reopen">Reopen</option>
                  )}

                  {canComplete && (
                    <option value="Completed">Completed</option>
                  )}
                </select>

                {isLocked && (
                  <p className="status-control__help">
                    This task is on hold. Reopen it to allow the
                    assignee to update its status.
                  </p>
                )}

                {!canPutOnHold && !canReopen && !canComplete && (
                  <p className="muted">
                    No status action is available right now.
                  </p>
                )}
              </div>

               {isReadOnly && (
                  <div className="alert">
                    This task is completed and is now read-only.
                    No further changes are allowed.
                  </div>
                )}
            </>
          )}

         

          {/* Assignee status dropdown */}
          {isAssignee && (
            <>
              <h3>Your Task Status</h3>

              <div className="status-control">
                <label htmlFor="assignee-status">
                  Update Status
                </label>

                <select
                  id="assignee-status"
                  value=""
                  onChange={handleAssigneeStatusChange}
                  disabled={
                    saving ||
                    isLocked ||
                    currentStatus === 'Completed' || isReadOnly
                  }
                >
                  <option value="" disabled>
                    Select status
                  </option>

                  {ASSIGNEE_STATUSES
                    .filter((status) => status !== currentStatus)
                    .map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                </select>

                {isReadOnly && (
                  <div className="alert">
                    This task is completed and is now read-only.
                    No further changes are allowed.
                  </div>
                )}

                {isLocked && (
                  <p className="status-control__help">
                    You cannot change the status until the creator
                    reopens this task.
                  </p>
                )}

                {currentStatus === 'Completed' && (
                  <p className="muted">
                    This task has been completed.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Creator reassignment */}
          {isCreator && !isReadOnly && (
            <>
              <h3>Reassign Task</h3>

              {currentStatus === 'Open' ? (
                <div className="reassign">
                  <label htmlFor="new-assignee">
                    Select one user
                  </label>

                  <select
                    id="new-assignee"
                    value={newAssignee}
                    onChange={(event) =>
                      setNewAssignee(event.target.value)
                    }
                    disabled={saving}
                  >
                    <option value="">Select user</option>

                    {users
                      .filter((item) => {
                        const itemId = getId(item);
                        return (
                          itemId !== creatorId &&
                          itemId !== assigneeId
                        );
                      })
                      .map((item) => (
                        <option
                          key={getId(item)}
                          value={getId(item)}
                        >
                          {item.name || item.email || getId(item)}
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={reassign}
                    disabled={saving || !newAssignee}
                  >
                    {saving ? 'Saving...' : 'Reassign'}
                  </button>
                </div>
              ) : (
                <p className="muted">
                  Reassignment is available only when the task status
                  is Open.
                </p>
              )}
            </>
          )}

          {/* Creator delete action */}
          {isCreator && !isReadOnly && canModifyTask && (
            <>
              <h3>Delete Task</h3>

              <button
                type="button"
                className="btn btn--danger"
                onClick={deleteTask}
                disabled={saving}
              >
                Delete Task
              </button>
            </>
          )}

          {!isCreator && !isAssignee && (
            <p className="muted">
              You can view this task but cannot manage it.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
