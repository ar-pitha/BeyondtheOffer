import { Navigate } from "react-router-dom";

function ProtectedRoute({ user, adminOnly, children }) {
  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" />;
  }

  return children;
}

export default ProtectedRoute;
