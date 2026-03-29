import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

type OwnerRow = {
  uid: string;
  fullName: string;
  email: string;
  role: "owner" | "superadmin";
  companyId: string | null;
  companyName?: string;
  isActive: boolean;
  isDeleted?: boolean;
};

export default function SuperadminDashboard() {
  const { profile, logout } = useAuth();
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("fullName", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const data: OwnerRow[] = snapshot.docs
        .map((d) => d.data() as OwnerRow)
        .filter((u) => u.role === "owner");
      setOwners(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSuspendToggle = async (user: OwnerRow) => {
    await updateDoc(doc(db, "users", user.uid), {
      isActive: !user.isActive,
    });
  };

  const handleSoftDelete = async (user: OwnerRow) => {
    const ok = window.confirm(
      `A je i sigurt qe don me fshi pronarin ${user.fullName}?`
    );
    if (!ok) return;

    await updateDoc(doc(db, "users", user.uid), {
      isDeleted: true,
      isActive: false,
    });
  };

  const handleRestore = async (user: OwnerRow) => {
    await updateDoc(doc(db, "users", user.uid), {
      isDeleted: false,
      isActive: true,
    });
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Superadmin Dashboard</h1>
          <p style={styles.subtitle}>Pershendetje, {profile?.fullName}</p>
        </div>

        <button style={styles.logoutBtn} onClick={logout}>
          Logout
        </button>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Pronaret</h2>
          <span style={styles.badge}>{owners.length} gjithsej</span>
        </div>

        {loading ? (
          <p style={styles.empty}>Duke u ngarku...</p>
        ) : owners.length === 0 ? (
          <p style={styles.empty}>Nuk ka pronare ende.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Emri</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Kompania</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Veprime</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((owner) => (
                  <tr key={owner.uid}>
                    <td style={styles.td}>{owner.fullName}</td>
                    <td style={styles.td}>{owner.email}</td>
                    <td style={styles.td}>{owner.companyName || "-"}</td>
                    <td style={styles.td}>
                      {owner.isDeleted
                        ? "Deleted"
                        : owner.isActive
                        ? "Active"
                        : "Suspended"}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        {!owner.isDeleted && (
                          <button
                            style={styles.actionBtn}
                            onClick={() => handleSuspendToggle(owner)}
                          >
                            {owner.isActive ? "Suspendo" : "Aktivizo"}
                          </button>
                        )}

                        {!owner.isDeleted ? (
                          <button
                            style={styles.deleteBtn}
                            onClick={() => handleSoftDelete(owner)}
                          >
                            Fshij
                          </button>
                        ) : (
                          <button
                            style={styles.restoreBtn}
                            onClick={() => handleRestore(owner)}
                          >
                            Rikthe
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  card: {
    background: "#111827",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
    flexWrap: "wrap",
  },
  cardTitle: {
    margin: 0,
  },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "#1e293b",
    color: "#cbd5e1",
    fontSize: 13,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: 12,
    borderBottom: "1px solid #374151",
    color: "#cbd5e1",
    fontWeight: 700,
    fontSize: 14,
  },
  td: {
    padding: 12,
    borderBottom: "1px solid #1f2937",
    fontSize: 14,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  actionBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
  },
  deleteBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: "#dc2626",
    color: "white",
    cursor: "pointer",
  },
  restoreBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: "#16a34a",
    color: "white",
    cursor: "pointer",
  },
  empty: {
    color: "#94a3b8",
    margin: 0,
  },
};