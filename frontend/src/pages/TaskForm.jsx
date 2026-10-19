
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/authContext';
import {
  PRIORITIES,
  MAX_FILE_MB,
  ALLOWED_EXT,
  toInputDate,
} from '../constants';

// Get today's date in YYYY-MM-DD format using local time.
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export default function TaskForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fileInputRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [today] = useState(getTodayDate);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    dueDate: '',
    assignedTo: user?.id || user?._id || '',
  });

  const [file, setFile] = useState(null);
  const [existingFile, setExistingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showFilePopup, setShowFilePopup] = useState(false);

  // Create a temporary URL for previewing the selected file.
  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Load users and task details when editing.
  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const res = await api.post('/users/list');

        if (!cancelled) {
          setUsers(res.data.users || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err.response?.data || err);
        }
      }
    };

    const loadTask = async () => {
      if (!isEdit) return;

      try {
        const { data } = await api.post('/tasks/details', { id });
        const task = data.task;

        if (cancelled) return;

        const creatorId = String(
          task.createdBy?._id ||
          task.createdBy ||
          ''
        );

        const currentUserId = String(
          user?.id ||
          user?._id ||
          ''
        );

        if (creatorId !== currentUserId) {
          navigate(`/tasks/${id}`, { replace: true });
          return;
        }

        setForm({
          title: task.title || '',
          description: task.description || '',
          priority: task.priority || 'Medium',
          dueDate: toInputDate(task.dueDate),
          assignedTo:
            task.assignedTo?._id ||
            task.assignedTo ||
            currentUserId,
        });

        if (task.attachment?.originalName) {
          setExistingFile({
            originalName: task.attachment.originalName,
            url:
              task.attachment.url ||
              task.attachment.path ||
              '',
          });
        } else {
          setExistingFile(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err.response?.data || err);
          navigate('/tasks', { replace: true });
        }
      }
    };

    loadUsers();
    loadTask();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, navigate, user?.id, user?._id]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'dueDate' && value && value < getTodayDate()) {
      setError('Due date cannot be in the past.');
    } else {
      setError('');
    }
  };

  // Select and validate an attachment.
  const handleFile = (e) => {
    const selectedFile = e.target.files?.[0];

    setError('');

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const ext = selectedFile.name
      .slice(selectedFile.name.lastIndexOf('.'))
      .toLowerCase();

    if (!ALLOWED_EXT.includes(ext)) {
      e.target.value = '';
      setFile(null);
      setError(
        `Allowed file types: ${ALLOWED_EXT.join(', ')}`
      );
      return;
    }

    if (selectedFile.size > MAX_FILE_MB * 1024 * 1024) {
      e.target.value = '';
      setFile(null);
      setError(
        `File must be ${MAX_FILE_MB} MB or smaller`
      );
      return;
    }

    setFile(selectedFile);
  };

  // Remove the newly selected file.
  const removeSelectedFile = () => {
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit the task.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!form.dueDate) {
      setError('Due date is required');
      return;
    }

    if (form.dueDate < getTodayDate()) {
      setError('Due date cannot be in the past.');
      return;
    }

    if (!isEdit && !form.assignedTo) {
      setError('Please select one assignee');
      return;
    }

    const data = new FormData();

    data.append('title', form.title.trim());
    data.append('description', form.description);
    data.append('priority', form.priority);
    data.append('dueDate', form.dueDate);

    if (!isEdit) {
      data.append('assignedTo', form.assignedTo);
    }

    if (file) {
      data.append('attachment', file);
    }

    setSubmitting(true);

    try {
      if (isEdit) {
        data.append('id', id);
        await api.post('/tasks/update', data);
        navigate(`/tasks/${id}`);
      } else {
        await api.post('/tasks/create', data);
        navigate('/tasks');
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Could not save the task'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      
<div className="page-head task-form-head">
  <div>
    <span className="task-form-head__eyebrow">
      TASK MANAGEMENT
    </span>

    <h1>
      {isEdit ? 'Edit task' : 'Create a new task'}
    </h1>

    <p>
      {isEdit
        ? 'Update your task details and attachment.'
        : 'Add the details below to organize and assign your work.'}
    </p>
  </div>

  {/* <Link
    className="btn btn--ghost"
    to={isEdit ? `/tasks/${id}` : '/tasks'}
  >
    Cancel
  </Link> */}
</div>


      <form
        className="form card"
        onSubmit={handleSubmit}
        noValidate
      >
        {error && (
          <div className="form__error">{error}</div>
        )}

        <label className="form__field">
          <span>Title *</span>

          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Prepare weekly report"
            required
          />
        </label>

        <label className="form__field">
          <span>Description</span>

          <textarea
            name="description"
            rows="4"
            value={form.description}
            onChange={handleChange}
          />
        </label>

        <div className="form__row">
          <label className="form__field">
            <span>Priority</span>

            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <label className="form__field">
            <span>Due date *</span>

            <input
              type="date"
              id="dueDate"
              name="dueDate"
              min={today}
              value={form.dueDate}
              onChange={handleChange}
              required
            />
          </label>
        </div>

        {!isEdit && (
          <label className="form__field">
            <span>Assign to *</span>

            <select
              name="assignedTo"
              value={form.assignedTo}
              onChange={handleChange}
              required
            >
              <option value="">Select one user</option>

              {users.map((u) => {
                const userId = String(u._id || u.id || '');

                return (
                  <option key={userId} value={userId}>
                    {userId === String(user?.id || user?._id)
                      ? `${u.name} (Me)`
                      : u.name}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        {/* Attachment section */}
        <div className="form__field">
          <span>
            Attachment (optional, max {MAX_FILE_MB} MB)
          </span>

          <input
            ref={fileInputRef}
            id="attachment"
            className="attachment-input"
            type="file"
            accept={ALLOWED_EXT.join(',')}
            onChange={handleFile}
          />

          <label
            htmlFor="attachment"
            className="attachment-upload"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.82l8.49-8.48" />
            </svg>

            <span>
              {file ? 'Choose another file' : 'Choose a file'}
            </span>
          </label>

          {/* Newly selected file */}
          {file && (
            <div className="attachment-preview">
              <div className="attachment-file-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M8 13h8M8 17h8" />
                </svg>
              </div>

              <div className="attachment-file-details">
                <span
                  className="attachment-file-name"
                  title={file.name}
                >
                  {file.name}
                </span>

                <span className="attachment-file-size">
                  {file.size >= 1024 * 1024
                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                    : `${(file.size / 1024).toFixed(1)} KB`}
                </span>
              </div>

              <button
                type="button"
                className="attachment-view"
                disabled={!previewUrl}
                onClick={() => setShowFilePopup(true)}
              >
                View
              </button>

              <button
                type="button"
                className="attachment-remove"
                onClick={removeSelectedFile}
                aria-label="Remove selected file"
                title="Remove file"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
                </svg>
              </button>
            </div>
          )}

          {/* Image preview */}
          {/* {file?.type.startsWith('image/') && previewUrl && (
            <div className="attachment-image-preview">
              <img
                src={previewUrl}
                alt="Selected attachment preview"
              />
            </div>
          )} */}

          {/* PDF preview */}
          {/* {file?.type === 'application/pdf' && previewUrl && (
            <div className="attachment-pdf-preview">
              <iframe
                src={previewUrl}
                title="PDF attachment preview"
                width="100%"
                height="400"
              />
            </div>
          )} */}

          {/* Existing file while editing */}
          {existingFile && !file && (
            <div className="attachment-preview">
              <div className="attachment-file-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>

              <div className="attachment-file-details">
                <span
                  className="attachment-file-name"
                  title={existingFile.originalName}
                >
                  {existingFile.originalName}
                </span>

                <span className="attachment-file-size">
                  Existing attachment
                </span>
              </div>

              {existingFile.url && (
                <button
                  type="button"
                  className="attachment-view"
                  onClick={() =>
                    window.open(
                      existingFile.url,
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                >
                  View
                </button>
              )}
            </div>
          )}
        </div>

        <div className="form__actions">
          <Link
            className="btn btn--ghost "
            to={isEdit ? `/tasks/${id}` : '/tasks'}
          >
            Cancel
          </Link>
          
          <button
            className="btn btn--primary "
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'Saving...'
              : isEdit
                ? 'Save changes'
                : 'Create task'}
          </button>
        </div>
      </form>

      
{showFilePopup && file && previewUrl && (
  <div
    className="file-modal-overlay"
    onClick={() => setShowFilePopup(false)}
  >
    <div
      className="file-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-modal-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="file-modal__header">
        <div>
          <h2 id="file-modal-title">File Preview</h2>
          <p>{file.name}</p>
        </div>

        <button
          type="button"
          className="file-modal__close"
          onClick={() => setShowFilePopup(false)}
          aria-label="Close preview"
        >
          &times;
        </button>
      </div>

      <div className="file-modal__body">
        {file.type.startsWith('image/') ? (
          <img
            src={previewUrl}
            alt={file.name}
          />
        ) : file.type === 'application/pdf' ? (
          <iframe
            src={previewUrl}
            title={`Preview of ${file.name}`}
          />
        ) : (
          <p>Preview is not available for this file type.</p>
        )}
      </div>

      <div className="file-modal__footer">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setShowFilePopup(false)}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

    </>
  );
}
