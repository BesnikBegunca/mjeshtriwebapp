import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { useNavigate, Link } from "react-router-dom";

export default function RegisterOwnerSelf() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!fullName || !companyName || !email || !password) {
      setError("Ploteso krejt fushat.");
      return;
    }

    try {
      setSaving(true);

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      const companyId = crypto.randomUUID();

      await setDoc(doc(db, "companies", companyId), {
        id: companyId,
        name: companyName,
        ownerUid: uid,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", uid), {
        uid,
        fullName,
        email,
        role: "owner",
        companyId,
        companyName,
        isActive: true,
        isDeleted: false,
        createdAt: serverTimestamp(),
      });

      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Gabim gjate regjistrimit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <form style={styles.card} onSubmit={handleRegister}>
        <h1 style={styles.title}>Regjistro Pronarin</h1>

        <input
          style={styles.input}
          type="text"
          placeholder="Emri i plote"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <input
          style={styles.input}
          type="text"
          placeholder="Emri i kompanise"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />

        <input
          style={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <p style={styles.error}>{error}</p> : null}

        <button style={styles.button} type="submit" disabled={saving}>
          {saving ? "Duke u regjistru..." : "Regjistrohu"}
        </button>

        <p style={styles.text}>
          Ke account? <Link to="/login">Kyçu</Link>
        </p>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0b1020",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    background: "#111827",
    borderRadius: 18,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  },
  title: {
    color: "#fff",
    margin: 0,
    textAlign: "center",
  },
  input: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid #374151",
    background: "#1f2937",
    color: "#fff",
    outline: "none",
  },
  button: {
    padding: 12,
    border: "none",
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    margin: 0,
    color: "#fca5a5",
  },
  text: {
    margin: 0,
    color: "#d1d5db",
    textAlign: "center",
  },
};