import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = {
  children: ReactNode;
  allowedRoles?: Array<"superadmin" | "owner">;
};

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { firebaseUser, profile, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 30 }}>Loading...</div>;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <div style={{ padding: 30 }}>Profili nuk u gjet ne databaze.</div>;
  }

  if (profile.isDeleted) {
    return <div style={{ padding: 30 }}>Ky account eshte fshire.</div>;
  }

  if (!profile.isActive) {
    return <div style={{ padding: 30 }}>Ky account eshte i suspenduar.</div>;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}