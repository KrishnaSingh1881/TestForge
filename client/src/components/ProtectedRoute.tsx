import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  allowedRoles?: Array<'student' | 'admin' | 'super_admin'>;
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
          Loading...
        </span>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <Outlet />;
}
