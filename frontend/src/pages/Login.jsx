import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/authContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);   // saves token AND sets user in context
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue to your tasks."
      footer={<>Don’t have an account? <Link to="/register">Create one</Link></>}
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error && <div className="form__error">{error}</div>}

        <label className="form__field">
          <span>Email</span>
          <input type="email" name="email" placeholder="you@example.com"
            value={form.email} onChange={handleChange} required />
        </label>

        <label className="form__field">
          <span>Password</span>
          <input type="password" name="password" placeholder="Your password"
            value={form.password} onChange={handleChange} required />
        </label>

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}