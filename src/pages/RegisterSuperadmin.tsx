import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { useNavigate } from "react-router-dom";

export default function RegisterSuperadmin() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("Super Admin");
  const [email, setEmail] = useState("appmjeshtri@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName || !email || !password) {
      setError("Ploteso krejt fushat.");
      return;
    }

    try {
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        fullName,
        email,
        role: "superadmin",
        companyId: null,
        isActive: true,
        createdAt: serverTimestamp(),
      });

      setSuccess("Superadmin u kriju me sukses. Tash mundesh me bo login.");
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Gabim gjate regjistrimit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <form style={styles.card} onSubmit={handleRegister}>
        <h1 style={styles.title}>Register Superadmin</h1>

        <input
          style={styles.input}
          type="text"
          placeholder="Emri i plote"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
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
        {success ? <p style={styles.success}>{success}</p> : null}

        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? "Duke u regjistru..." : "Regjistro Superadmin"}
        </button>
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
    maxWidth: 420,
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
  success: {
    margin: 0,
    color: "#86efac",
  },
};