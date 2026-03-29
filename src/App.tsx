import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { KalkuloPage } from "./pages/KalkuloPage";
import { WorkersPage } from "./pages/WorkersPage";
import { QmimorjaPage } from "./pages/QmimorjaPage";
import { ParametersPage } from "./pages/ParametersPage";
import { FirmaPage } from "./pages/FirmaPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import KalkuloProductPage from "./pages/KalkuloProductPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/kalkulo" element={<KalkuloPage />} />
        <Route path="/kalkulo/produkt" element={<KalkuloProductPage />} />
        <Route path="/workers" element={<WorkersPage />} />
        <Route path="/qmimorja" element={<QmimorjaPage />} />
        <Route path="/parameters" element={<ParametersPage />} />
        <Route path="/firma" element={<FirmaPage />} />
      </Route>
    </Routes>
  );
}