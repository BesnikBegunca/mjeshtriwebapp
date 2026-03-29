import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("appmjeshtri@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case "auth/invalid-email":
        return "Email-i nuk eshte valid.";
      case "auth/invalid-credential":
        return "Email ose password gabim.";
      case "auth/user-disabled":
        return "Ky account eshte i bllokuar.";
      default:
        return "Gabim gjate kyqjes.";
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Ploteso email dhe password.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError(getFirebaseErrorMessage(err.code));
      } else {
        setError("Diqka shkoi keq.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <form style={styles.card} onSubmit={handleLogin}>
        <h1 style={styles.title}>Mjeshtri</h1>
        <p style={styles.subtitle}>Kyçu në sistem</p>

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

        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? "Duke u kyqur..." : "Kyqu"}
        </button>

        {/* Divider */}
        <div style={styles.divider}></div>

        {/* Register Owner */}
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => navigate("/register-owner")}
        >
          Regjistrohu si Pronari
        </button>

        {/* OPTIONAL Superadmin */}
        <button
          type="button"
          style={styles.linkButton}
          onClick={() => navigate("/register-superadmin")}
        >
          Register Superadmin (dev)
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
    background: "linear-gradient(135deg,#0b1020,#111827)",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#111827",
    borderRadius: 20,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
  },
  title: {
    color: "#fff",
    margin: 0,
    textAlign: "center",
    fontSize: 28,
    fontWeight: 800,
  },
  subtitle: {
    color: "#9ca3af",
    textAlign: "center",
    margin: 0,
    marginBottom: 10,
  },
  input: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #374151",
    background: "#1f2937",
    color: "#fff",
    outline: "none",
    fontSize: 14,
  },
  button: {
    padding: 12,
    border: "none",
    borderRadius: 12,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 6,
  },
  secondaryButton: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #374151",
    background: "#1f2937",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  linkButton: {
    background: "transparent",
    border: "none",
    color: "#60a5fa",
    cursor: "pointer",
    fontSize: 13,
  },
  divider: {
    height: 1,
    background: "#374151",
    margin: "10px 0",
  },
  error: {
    margin: 0,
    color: "#fca5a5",
    fontSize: 13,
  },
};