import { Calculator, Euro, Package, TrendingUp, Users } from "lucide-react";
import { StatCard } from "../components/ui/StatCard";

export function DashboardPage() {
    return (
        <div className="page-grid">
            <div className="stats-grid">
                <StatCard
                    title="Punëtorë"
                    value="12"
                    hint="Stafi aktiv"
                    icon={<Users size={18} />}
                />
                <StatCard
                    title="Artikuj qmimorja"
                    value="148"
                    hint="Produkte dhe shërbime"
                    icon={<Package size={18} />}
                />
                <StatCard
                    title="Kalkulime"
                    value="27"
                    hint="Ky muaj"
                    icon={<Calculator size={18} />}
                />
                <StatCard
                    title="Qarkullimi"
                    value="€12,480"
                    hint="+8.2% nga muaji i kaluar"
                    icon={<Euro size={18} />}
                />
            </div>

            <div className="dashboard-banner">
                <div className="card hero-card">
                    <span className="pill">
                        <TrendingUp size={15} />
                        Premium Workspace
                    </span>

                    <h3 style={{ marginTop: 16 }}>Mirë se vjen në Mjeshtri Web Pro</h3>

                    <p>
                        Ky është versioni modern i Mjeshtri-t për web: kalkulo premium,
                        menaxhim i punëtorëve, qmimore profesionale, parametrat e bojës,
                        profili i firmës dhe ma vonë projektet, avancat dhe raportet.
                    </p>
                </div>

                <div className="card">
                    <h3>Shpejt</h3>
                    <p>Kontrollo kalkulimet, ruaj parametrat dhe menaxho artikujt në një vend.</p>
                </div>
            </div>
        </div>
    );
}