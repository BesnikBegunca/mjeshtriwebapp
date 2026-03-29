import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

export default function RegisterOwner() {
  const { profile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const superadminEmail = "appmjeshtri@gmail.com";

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (profile?.role !== "superadmin") {
      setError("Vetem superadmin mundet me kriju pronar.");
      return;
    }

    if (!fullName || !companyName || !email || !password) {
      setError("Ploteso krejt fushat.");
      return;
    }

    try {
      setSaving(true);

      const currentAdminEmail = auth.currentUser?.email;
      const adminPassword = window.prompt(
        "Shkruje password-in e superadminit per me vazhdu:"
      );

      if (!currentAdminEmail || !adminPassword) {
        throw new Error("Krijimi u anulua.");
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const ownerUid = userCredential.user.uid;
      const companyId = crypto.randomUUID();

      await setDoc(doc(db, "companies", companyId), {
        id: companyId,
        name: companyName,
        ownerUid,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", ownerUid), {
        uid: ownerUid,
        fullName,
        email,
        role: "owner",
        companyId,
        isActive: true,
        createdAt: serverTimestamp(),
      });

      await signOut(auth);
      await signInWithEmailAndPassword(auth, superadminEmail, adminPassword);

      setMessage("Pronari u kriju me sukses.");
      setFullName("");
      setCompanyName("");
      setEmail("");
      setPassword("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gabim gjate krijimit te pronarit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <form style={styles.card} onSubmit={handleCreateOwner}>
        <h2 style={styles.title}>Krijo Pronare</h2>

        <input
          style={styles.input}
          placeholder="Emri i plote"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="Emri i kompanise"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          style={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}

        <button style={styles.button} disabled={saving} type="submit">
          {saving ? "Duke kriju..." : "Krijo Pronarin"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { padding: 20 },
  card: {
    maxWidth: 500,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "#111827",
    padding: 20,
    borderRadius: 16,
  },
  title: { color: "white", margin: 0 },
  input: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid #374151",
    background: "#1f2937",
    color: "white",
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
  error: { color: "#fca5a5", margin: 0 },
  success: { color: "#86efac", margin: 0 },
};