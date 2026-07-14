// file: client/src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// A route guarded with roles={["admin"]} must also admit "superadmin" —
// superadmin is a strictly higher privilege level on the same Admin
// collection (see models/admin/Admin.js), not a separate account type.
// Checking `roles.includes(user.role)` directly would lock superadmins
// out of every admin-only route, since the literal string "superadmin"
// never appears in a roles array written as ["admin"].
function hasRequiredRole(user, roles) {
  if (!roles || roles.length === 0) return true;
  if (roles.includes("admin") && (user.role === "admin" || user.role === "superadmin")) {
    return true;
  }
  return roles.includes(user.role);
}

export default function ProtectedRoute({ children, roles }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <span className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin text-muted" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRequiredRole(user, roles)) {
    return <Navigate to="/" replace />;
  }

  return children;
}