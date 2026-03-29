import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { eur } from "../lib/money";
import {
    calculateLabor,
    calculatePaint,
    calculateProducts,
    calculateProductsTotals,
    findLaborItem,
} from "../lib/kalkulo";
import { getParameters } from "../services/parameters.service";
import { getQmimorjaItems } from "../services/qmimorja.service";
import type { ProductCalcItem } from "../types";

const mockProducts: ProductCalcItem[] = [
    {
        id: "1",
        kodi: "A-01",
        emertimi: "Akril Primer",
        pako: "25L",
        sasiaPer100m2: 1,
        vleraPer100m2: 25,
        tvshPer100m2: 4.5,
        ownerId: "",
    },
    {
        id: "2",
        kodi: "B-02",
        emertimi: "Bojë e brendshme",
        pako: "25L",
        sasiaPer100m2: 2,
        vleraPer100m2: 60,
        tvshPer100m2: 10.8,
        ownerId: "",
    },
];

export function KalkuloPage() {
    const [m2, setM2] = useState("100");
    const [includePaint, setIncludePaint] = useState(true);
    const [useFixedLabor, setUseFixedLabor] = useState(false);
    const [fixedLaborValue, setFixedLaborValue] = useState("0");

    const {
        data: parameters,
        isLoading: parametersLoading,
        error: parametersError,
    } = useQuery({
        queryKey: ["parameters"],
        queryFn: getParameters,
    });

    const {
        data: qmimorja = [],
        isLoading: qmimorjaLoading,
        error: qmimorjaError,
    } = useQuery({
        queryKey: ["qmimorja"],
        queryFn: getQmimorjaItems,
    });

    const area = Number(m2 || 0);

    const laborItem = useMemo(() => {
        if (!parameters) return null;
        return findLaborItem(qmimorja, parameters.laborCategory);
    }, [parameters, qmimorja]);

    const paint = useMemo(() => {
        if (!parameters || !includePaint) {
            return { liters: 0, buckets: 0, total: 0 };
        }

        return calculatePaint(area, parameters);
    }, [area, includePaint, parameters]);

    const laborTotal = useMemo(() => {
        return calculateLabor(
            area,
            laborItem?.price ?? 0,
            Number(fixedLaborValue || 0),
            useFixedLabor
        );
    }, [area, laborItem?.price, fixedLaborValue, useFixedLabor]);

    const productRows = useMemo(() => {
        return calculateProducts(area, mockProducts);
    }, [area]);

    const productsTotals = useMemo(() => {
        return calculateProductsTotals(productRows);
    }, [productRows]);

    const grandTotal = productsTotals.total + laborTotal + paint.total;

    if (parametersError || qmimorjaError) {
        return (
            <div className="card">
                <p>Ndodhi një gabim gjatë ngarkimit të të dhënave për kalkulim.</p>
            </div>
        );
    }

    if (parametersLoading || qmimorjaLoading) {
        return (
            <div className="card">
                <p>Duke i ngarkuar të dhënat e kalkulos...</p>
            </div>
        );
    }

    return (
        <div className="kalkulo-layout">
            <div className="card stack-md">
                <h3>Kalkulo</h3>

                <input
                    className="input"
                    type="number"
                    placeholder="Sipërfaqja m²"
                    value={m2}
                    onChange={(e) => setM2(e.target.value)}
                />

                <label className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={includePaint}
                        onChange={(e) => setIncludePaint(e.target.checked)}
                    />
                    <span>Përfshi ngjyrën</span>
                </label>

                <label className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={useFixedLabor}
                        onChange={(e) => setUseFixedLabor(e.target.checked)}
                    />
                    <span>Përdor vlerë fikse për punë dore</span>
                </label>

                {useFixedLabor ? (
                    <input
                        className="input"
                        type="number"
                        placeholder="Vlera fikse"
                        value={fixedLaborValue}
                        onChange={(e) => setFixedLaborValue(e.target.value)}
                    />
                ) : null}

                <div className="card" style={{ padding: 16 }}>
                    <span className="stat-title">Kategoria e punës</span>
                    <div style={{ marginTop: 8, fontWeight: 800 }}>
                        {parameters?.laborCategory ?? "Nuk ka parametra"}
                    </div>
                </div>
            </div>

            <div className="stack-lg">
                <div className="stats-grid">
                    <div className="card stat-card">
                        <span className="stat-title">Material pa TVSH</span>
                        <div className="stat-value">{eur(productsTotals.valueNoVat)}</div>
                    </div>

                    <div className="card stat-card">
                        <span className="stat-title">TVSH</span>
                        <div className="stat-value">{eur(productsTotals.vat)}</div>
                    </div>

                    <div className="card stat-card">
                        <span className="stat-title">Punë dore</span>
                        <div className="stat-value">{eur(laborTotal)}</div>
                    </div>

                    <div className="card stat-card">
                        <span className="stat-title">Ngjyra</span>
                        <div className="stat-value">{eur(paint.total)}</div>
                    </div>
                </div>

                <div className="card">
                    <div className="row-between">
                        <h3>Përmbledhje totale</h3>
                        <div className="grand-total">{eur(grandTotal)}</div>
                    </div>

                    <div className="mini-grid">
                        <div className="mini-item">
                            <span>Litra ngjyrë</span>
                            <strong>{paint.liters.toFixed(2)} L</strong>
                        </div>

                        <div className="mini-item">
                            <span>Kova</span>
                            <strong>{paint.buckets}</strong>
                        </div>

                        <div className="mini-item">
                            <span>Artikull pune</span>
                            <strong>{laborItem?.name ?? "Nuk u gjet"}</strong>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3>Produktet</h3>

                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Kodi</th>
                                    <th>Emërtimi</th>
                                    <th>Pako</th>
                                    <th>Sasia</th>
                                    <th>Pa TVSH</th>
                                    <th>TVSH</th>
                                    <th>Totali</th>
                                </tr>
                            </thead>

                            <tbody>
                                {productRows.map((row) => (
                                    <tr key={row.id}>
                                        <td>{row.kodi}</td>
                                        <td>{row.emertimi}</td>
                                        <td>{row.pako}</td>
                                        <td>{row.qty.toFixed(2)}</td>
                                        <td>{eur(row.valueNoVat)}</td>
                                        <td>{eur(row.vat)}</td>
                                        <td>{eur(row.total)}</td>
                                    </tr>
                                ))}

                                {productRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>Nuk ka produkte për kalkulim.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}