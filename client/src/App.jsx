import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Preloader from "./components/Preloader";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
//user pages
import LoginPage from "./pages/user/LoginPage";
import WelcomePage from "./pages/user/WelcomePage";
import UserDashboard from "./pages/user/dashboard/UserDashboard";
//admin pages
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";

const App = () => {
  const [loading, setLoading] = useState(true);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Preloader loading={loading} onDone={() => setLoading(false)} />
        <Routes>
          {/* user routes */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* /dashboard and /dashboard/:tab both render UserDashboard —
              kept as two explicit routes (rather than one "/dashboard/:tab?"
              pattern) so this works regardless of react-router-dom version.
              UserDashboard itself normalizes a bare /dashboard to
              /dashboard/overview via <Navigate replace>. */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={["citizen"]}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:tab"
            element={
              <ProtectedRoute roles={["citizen"]}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />

          {/* admin routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;