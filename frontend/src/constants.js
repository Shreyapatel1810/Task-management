export const STATUSES = ['Open', 'In Progress', 'On Hold', 'In Review', 'Completed'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const MAX_FILE_MB = 5;
export const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt'];

export const slug = (value = "") => {
  return String(value).toLowerCase().trim().replace(/\s+/g, "-");
};


// Due dates are stored as end-of-day UTC, so always format in UTC
export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
export const toInputDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');