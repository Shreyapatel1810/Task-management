
import { slug } from '../constants';

export const StatusBadge = ({ status = 'pending' }) => (
  <span className={`badge badge--status-${slug(status)}`}>
    {status}
  </span>
);

export const PriorityBadge = ({ priority = 'Medium' }) => (
  <span className={`badge badge--priority-${slug(priority)}`}>
    {priority}
  </span>
);

// Shows whether you created the task, are assigned to it, or both
export function RoleBadge({ task, userId }) {
  const currentUserId = String(userId || '');

  // Handle populated user objects and plain MongoDB IDs
  const createdById = String(
    task?.createdBy?._id || task?.createdBy || ''
  );

  const assignedToId = String(
    task?.assignedTo?._id || task?.assignedTo || ''
  );

  const created = createdById === currentUserId;
  const assigned = assignedToId === currentUserId;

  if (created && assigned) {
    return (
      <span className="badge badge--role-self">
        Self task
      </span>
    );
  }

  if (created) {
    return (
      <span className="badge badge--role-created">
        Created by you
      </span>
    );
  }

  if (assigned) {
    return (
      <span className="badge badge--role-assigned">
        Assigned to you
      </span>
    );
  }

  return <span className="badge">Related</span>;
}
