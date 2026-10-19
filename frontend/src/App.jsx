import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/authContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import TaskForm from './pages/TaskForm';
import TaskDetails from './pages/TaskDetails';

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader">Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader">Loading…</div>;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
           <Route path="/tasks/new" element={<TaskForm />} />
          <Route path="/tasks/:id" element={<TaskDetails />} /> 
          <Route path="/tasks/:id/edit" element={<TaskForm />} /> 
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}