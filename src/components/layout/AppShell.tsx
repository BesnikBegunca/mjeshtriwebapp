import {
    Building2,
    Calculator,
    LayoutDashboard,
    Settings,
    Users,
    WalletCards,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/kalkulo", label: "Kalkulo", icon: Calculator },
    { to: "/workers", label: "Punëtorët", icon: Users },
    { to: "/qmimorja", label: "Qmimorja", icon: WalletCards },
    { to: "/parameters", label: "Parametrat", icon: Settings },
    { to: "/firma", label: "Firma", icon: Building2 },
];

export function AppShell() {
    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-badge">M</div>
                    <div>
                        <h1>Mjeshtri</h1>
                        <p>Web Pro</p>
                    </div>
                </div>

                <nav className="nav">
                    {items.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `nav-link ${isActive ? "active" : ""}`
                            }
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div>
                        <h2 className="page-title">Mjeshtri Management</h2>
                        <p className="page-subtitle">
                            Premium construction workspace for kalkulime, punëtorë dhe qmimore
                        </p>
                    </div>

                    <div className="topbar-user">Owner</div>
                </header>

                <section className="content-area">
                    <Outlet />
                </section>
            </main>
        </div>
    );
}