import { useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerOwner } from "../services/auth.service";

export function RegisterPage() {
    const navigate = useNavigate();

    const [companyName, setCompanyName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await registerOwner(email.trim(), password, companyName.trim());
            navigate("/dashboard", { replace: true });
        } catch {
            setError("Regjistrimi dështoi. Kontrollo të dhënat.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={styles.page}>
            <div style={styles.bgGlowOne} />
            <div style={styles.bgGlowTwo} />

            <div style={styles.card}>
                <div style={styles.logoWrap}>
                    <div style={styles.logoBadge}>M</div>
                    <div>
                        <h1 style={styles.brandTitle}>Mjeshtri</h1>
                        <p style={styles.brandSub}>Web Pro</p>
                    </div>
                </div>

                <div style={styles.header}>
                    <h2 style={styles.title}>Regjistrohu</h2>
                    <p style={styles.subtitle}>Krijo kompaninë dhe llogarinë tënde</p>
                </div>

                <form onSubmit={onSubmit} style={styles.form}>
                    <div style={styles.fieldWrap}>
                        <label style={styles.label}>Emri i kompanisë</label>
                        <input
                            style={styles.input}
                            type="text"
                            placeholder="Mjeshtri Shpk"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                        />
                    </div>

                    <div style={styles.fieldWrap}>
                        <label style={styles.label}>Email</label>
                        <input
                            style={styles.input}
                            type="email"
                            placeholder="example@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div style={styles.fieldWrap}>
                        <label style={styles.label}>Password</label>
                        <input
                            style={styles.input}
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error ? <div style={styles.errorBox}>{error}</div> : null}

                    <button type="submit" disabled={loading} style={styles.button}>
                        {loading ? "Duke u regjistruar..." : "Regjistrohu"}
                    </button>
                </form>

                <div style={styles.footer}>
                    E ke account-in?{" "}
                    <Link to="/login" style={styles.link}>
                        Kyqu
                    </Link>
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, CSSProperties> = {
    page: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
        background:
            "radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(124,58,237,0.16), transparent 26%), linear-gradient(180deg, #08101d 0%, #0b1324 55%, #0d172a 100%)",
        fontFamily:
            'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },

    bgGlowOne: {
        position: "absolute",
        width: "320px",
        height: "320px",
        borderRadius: "999px",
        background: "rgba(37,99,235,0.18)",
        filter: "blur(80px)",
        top: "-60px",
        left: "-40px",
        pointerEvents: "none",
    },

    bgGlowTwo: {
        position: "absolute",
        width: "280px",
        height: "280px",
        borderRadius: "999px",
        background: "rgba(124,58,237,0.16)",
        filter: "blur(80px)",
        bottom: "-40px",
        right: "-20px",
        pointerEvents: "none",
    },

    card: {
        width: "100%",
        maxWidth: "460px",
        position: "relative",
        zIndex: 2,
        borderRadius: "28px",
        padding: "30px 28px",
        background: "rgba(15, 23, 42, 0.88)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
        backdropFilter: "blur(18px)",
        color: "#ffffff",
    },

    logoWrap: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "26px",
    },

    logoBadge: {
        width: "52px",
        height: "52px",
        borderRadius: "18px",
        display: "grid",
        placeItems: "center",
        fontSize: "24px",
        fontWeight: 900,
        color: "#fff",
        background: "linear-gradient(135deg, #2563eb, #7c3aed)",
        boxShadow: "0 12px 28px rgba(37,99,235,0.28)",
    },

    brandTitle: {
        margin: 0,
        fontSize: "22px",
        fontWeight: 900,
        letterSpacing: "-0.02em",
    },

    brandSub: {
        margin: "4px 0 0",
        color: "#94a3b8",
        fontSize: "13px",
    },

    header: {
        marginBottom: "20px",
    },

    title: {
        margin: 0,
        fontSize: "28px",
        fontWeight: 900,
        letterSpacing: "-0.03em",
    },

    subtitle: {
        margin: "8px 0 0",
        color: "#94a3b8",
        fontSize: "14px",
    },

    form: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },

    fieldWrap: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "100%",
    },

    label: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#cbd5e1",
        paddingLeft: "2px",
    },

    input: {
        width: "100%",
        maxWidth: "100%",
        padding: "12px 14px",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.05)",
        color: "#fff",
        outline: "none",
        fontSize: "14px",
        boxSizing: "border-box",
    },

    errorBox: {
        padding: "12px 14px",
        borderRadius: "14px",
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.24)",
        color: "#fecaca",
        fontSize: "13px",
    },

    button: {
        marginTop: "6px",
        width: "100%",
        padding: "13px 16px",
        border: 0,
        borderRadius: "16px",
        cursor: "pointer",
        fontWeight: 800,
        fontSize: "15px",
        color: "#fff",
        background: "linear-gradient(135deg, #2563eb, #7c3aed)",
        boxShadow: "0 14px 30px rgba(37,99,235,0.28)",
    },

    footer: {
        marginTop: "18px",
        fontSize: "14px",
        color: "#94a3b8",
        textAlign: "center",
    },

    link: {
        color: "#93c5fd",
        fontWeight: 700,
        textDecoration: "none",
    },
};