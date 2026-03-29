import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import RegisterSuperadmin from "./pages/RegisterSuperadmin";
import RegisterOwnerSelf from "./pages/RegisterOwnerSelf";
import SuperadminDashboard from "./pages/SuperadminDashboard";
import OwnerDashboard from "./pages/OwnerDashboard";
import ProtectedRoute from "./routes/ProtectedRoute";

function HomeRedirect() {
  const { loading, profile, firebaseUser } = useAuth();

  if (loading) {
    return <div style={{ padding: 30 }}>Loading...</div>;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <div style={{ padding: 30 }}>Profili nuk u gjet ne Firestore per kete user.</div>;
  }

  if (profile.isDeleted) {
    return <div style={{ padding: 30 }}>Ky account eshte fshire.</div>;
  }

  if (!profile.isActive) {
    return <div style={{ padding: 30 }}>Ky account eshte i suspenduar.</div>;
  }

  if (profile.role === "superadmin") {
    return <Navigate to="/superadmin" replace />;
  }

  if (profile.role === "owner") {
    return <Navigate to="/owner" replace />;
  }

  return <div style={{ padding: 30 }}>Rol i panjohur.</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register-superadmin" element={<RegisterSuperadmin />} />
        <Route path="/register-owner" element={<RegisterOwnerSelf />} />
        <Route path="/" element={<HomeRedirect />} />

        <Route
          path="/superadmin"
          element={
            <ProtectedRoute allowedRoles={["superadmin"]}>
              <SuperadminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/owner"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <OwnerDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}