import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/authContext';

const emptyForm = { name: '', email: '', password: '', confirm: '' };

export default function Register() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');

    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password); // saves token AND sets user in context
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It only takes a minute to get started."
      footer={<>Already have an account? <Link to="/login">Log in</Link></>}
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error && <div className="form__error">{error}</div>}

        <label className="form__field">
          <span>Full name</span>
          <input type="text" name="name" placeholder="Your name"
            value={form.name} onChange={handleChange} required />
        </label>

        <label className="form__field">
          <span>Email</span>
          <input type="email" name="email" placeholder="you@example.com"
            value={form.email} onChange={handleChange} required />
        </label>

        <label className="form__field">
          <span>Password</span>
          <input type="password" name="password" placeholder="At least 6 characters"
            value={form.password} onChange={handleChange} required />
        </label>

        <label className="form__field">
          <span>Confirm password</span>
          <input type="password" name="confirm" placeholder="Repeat your password"
            value={form.confirm} onChange={handleChange} required />
        </label>

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}