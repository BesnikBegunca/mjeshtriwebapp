import { useAuth } from "../context/AuthContext";

export default function OwnerDashboard() {
  const { profile, logout } = useAuth();

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Owner Dashboard</h1>
          <p style={styles.subtitle}>Pershendetje, {profile?.fullName}</p>
          <p style={styles.subtitle}>Kompania: {profile?.companyName || "-"}</p>
        </div>

        <button style={styles.logoutBtn} onClick={logout}>
          Logout
        </button>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>Punetoret</div>
        <div style={styles.card}>Punet / Projektet</div>
        <div style={styles.card}>Pushimet</div>
        <div style={styles.card}>Ditet / Orari</div>
        <div style={styles.card}>Ofertat</div>
        <div style={styles.card}>Raportet</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b1020",
    padding: 24,
    color: "white",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 16,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 28,
  },
  subtitle: {
    margin: "6px 0 0 0",
    color: "#94a3b8",
  },
  logoutBtn: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "#dc2626",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#111827",
    borderRadius: 18,
    padding: 24,
    minHeight: 120,
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },
};