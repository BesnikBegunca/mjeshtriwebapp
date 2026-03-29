import { useEffect, useMemo, useState } from "react";
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

type PageState = "loading" | "ready" | "error";

function toMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) return error.message;
    return "Ndodhi një gabim gjatë ngarkimit të të dhënave.";
}

export function KalkuloPage() {
    const [m2, setM2] = useState("100");
    const [includePaint, setIncludePaint] = useState(true);
    const [useFixedLabor, setUseFixedLabor] = useState(false);
    const [fixedLaborValue, setFixedLaborValue] = useState("0");
    const [loadingTooLong, setLoadingTooLong] = useState(false);

    const [customProducts, setCustomProducts] = useState<ProductCalcItem[]>([
        {
            id: "local-1",
            kodi: "A-01",
            emertimi: "Akril Primer",
            pako: "25L",
            sasiaPer100m2: 1,
            vleraPer100m2: 25,
            tvshPer100m2: 4.5,
            ownerId: "",
        },
        {
            id: "local-2",
            kodi: "B-02",
            emertimi: "Bojë e brendshme",
            pako: "25L",
            sasiaPer100m2: 2,
            vleraPer100m2: 60,
            tvshPer100m2: 10.8,
            ownerId: "",
        },
    ]);

    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([
        "local-1",
        "local-2",
    ]);

    const {
        data: parameters,
        isLoading: parametersLoading,
        isFetching: parametersFetching,
        error: parametersError,
        refetch: refetchParameters,
    } = useQuery({
        queryKey: ["parameters"],
        queryFn: async () => {
            const data = await getParameters();
            if (!data) {
                throw new Error("Parametrat nuk u gjetën.");
            }
            return data;
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
        retry: 1,
        refetchOnWindowFocus: false,
    });

    const {
        data: qmimorja = [],
        isLoading: qmimorjaLoading,
        isFetching: qmimorjaFetching,
        error: qmimorjaError,
        refetch: refetchQmimorja,
    } = useQuery({
        queryKey: ["qmimorja"],
        queryFn: async () => {
            const data = await getQmimorjaItems();
            return Array.isArray(data) ? data : [];
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
        retry: 1,
        refetchOnWindowFocus: false,
    });

    const isBusy = parametersLoading || qmimorjaLoading;
    const isRefreshing = parametersFetching || qmimorjaFetching;
    const hasError = !!parametersError || !!qmimorjaError;

    useEffect(() => {
        if (!isBusy) {
            setLoadingTooLong(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setLoadingTooLong(true);
        }, 8000);

        return () => window.clearTimeout(timer);
    }, [isBusy]);

    const area = useMemo(() => {
        const parsed = Number(m2);
        if (!Number.isFinite(parsed) || parsed < 0) return 0;
        return parsed;
    }, [m2]);

    const laborItem = useMemo(() => {
        if (!parameters) return null;
        return findLaborItem(qmimorja, parameters.laborCategory);
    }, [parameters, qmimorja]);

    const paint = useMemo(() => {
        if (!parameters || !includePaint || area <= 0) {
            return { liters: 0, buckets: 0, total: 0 };
        }

        try {
            return calculatePaint(area, parameters);
        } catch {
            return { liters: 0, buckets: 0, total: 0 };
        }
    }, [area, includePaint, parameters]);

    const laborTotal = useMemo(() => {
        try {
            return calculateLabor(
                area,
                laborItem?.price ?? 0,
                Number(fixedLaborValue || 0),
                useFixedLabor
            );
        } catch {
            return 0;
        }
    }, [area, laborItem?.price, fixedLaborValue, useFixedLabor]);

    const selectedProducts = useMemo(() => {
        return customProducts.filter((p) => selectedProductIds.includes(p.id));
    }, [customProducts, selectedProductIds]);

    const productRows = useMemo(() => {
        try {
            if (area <= 0) return [];
            return calculateProducts(area, selectedProducts);
        } catch {
            return [];
        }
    }, [area, selectedProducts]);

    const productsTotals = useMemo(() => {
        try {
            return calculateProductsTotals(productRows);
        } catch {
            return {
                valueNoVat: 0,
                vat: 0,
                total: 0,
            };
        }
    }, [productRows]);

    const grandTotal = productsTotals.total + laborTotal + paint.total;
    const pageState: PageState = hasError ? "error" : isBusy ? "loading" : "ready";

    const handleRetryAll = async () => {
        await Promise.all([refetchParameters(), refetchQmimorja()]);
    };

    const laborCategory = parameters?.laborCategory?.trim() || "Nuk ka parametra";
    const laborItemName = laborItem?.name?.trim() || "Nuk u gjet artikulli i punës";
    const errorText = [parametersError, qmimorjaError]
        .filter(Boolean)
        .map(toMessage)
        .join(" | ");

    const handleToggleProduct = (id: string) => {
        setSelectedProductIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    if (pageState === "error") {
        return (
            <div className="kalkulo-shell">
                <div className="kp-card kp-hero kp-error-card">
                    <div className="kp-hero__content">
                        <div className="kp-pill kp-pill--danger">Gabim</div>
                        <h1 className="kp-title">Kalkulo</h1>
                        <p className="kp-subtitle">
                            Ndodhi një problem gjatë ngarkimit të parametrave ose qmimores.
                        </p>
                        <div className="kp-error-text">{errorText || "Ngarkimi dështoi."}</div>
                    </div>

                    <div className="kp-hero__actions">
                        <button className="kp-btn kp-btn-primary" onClick={handleRetryAll}>
                            Provo përsëri
                        </button>
                    </div>
                </div>

                <style>{styles}</style>
            </div>
        );
    }

    if (pageState === "loading") {
        return (
            <div className="kalkulo-shell">
                <div className="kp-card kp-hero">
                    <div className="kp-hero__content">
                        <div className="kp-pill">Duke u ngarkuar</div>
                        <h1 className="kp-title">Kalkulo profesionale</h1>
                        <p className="kp-subtitle">Po ngarkohen parametrat dhe qmimorja...</p>
                    </div>

                    {loadingTooLong ? (
                        <div className="kp-hero__actions">
                            <button className="kp-btn kp-btn-primary" onClick={handleRetryAll}>
                                Rifresko të dhënat
                            </button>
                        </div>
                    ) : null}
                </div>

                <div className="kp-main-grid">
                    <div className="kp-left-stack">
                        <div className="kp-card kp-panel">
                            <div className="skeleton skeleton-title" />
                            <div className="skeleton skeleton-input" />
                            <div className="skeleton skeleton-input" />
                            <div className="skeleton skeleton-box" />
                        </div>
                    </div>

                    <div className="kp-right-stack">
                        <div className="kp-stats-grid">
                            <div className="kp-card"><div className="skeleton skeleton-stat" /></div>
                            <div className="kp-card"><div className="skeleton skeleton-stat" /></div>
                            <div className="kp-card"><div className="skeleton skeleton-stat" /></div>
                            <div className="kp-card"><div className="skeleton skeleton-stat" /></div>
                        </div>

                        <div className="kp-card">
                            <div className="skeleton skeleton-title" />
                            <div className="skeleton skeleton-box" />
                        </div>

                        <div className="kp-card">
                            <div className="skeleton skeleton-title" />
                            <div className="skeleton skeleton-table" />
                        </div>
                    </div>
                </div>

                {loadingTooLong ? (
                    <div className="kp-card kp-warning-card">
                        <strong>Ngarkimi po zgjat më shumë se zakonisht.</strong>
                        <p>Kontrollo services ose provo rifreskimin.</p>
                    </div>
                ) : null}

                <style>{styles}</style>
            </div>
        );
    }

    return (
        <div className="kalkulo-shell">
            <div className="kp-card kp-hero kp-hero--premium">
                <div className="kp-hero__content">
                    <div className="kp-hero__topline">
                        <span className="kp-pill kp-pill--success">Aktive</span>
                        <span className="kp-dot-sep">•</span>
                        <span className="kp-meta-soft">{selectedProducts.length} produkte aktive</span>
                        <span className="kp-dot-sep">•</span>
                        <span className="kp-meta-soft">{qmimorja.length} artikuj në qmimore</span>
                    </div>

                    <h1 className="kp-title">Kalkulo profesionale</h1>
                    <p className="kp-subtitle">
                        Llogarit materialin, TVSH-në, punën dore dhe ngjyrën. Produktet këtu
                        shfaqen vetëm si listë me checkbox.
                    </p>
                </div>

                <div className="kp-hero__actions">
                    <button
                        className="kp-btn kp-btn-secondary"
                        onClick={handleRetryAll}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? "Duke rifreskuar..." : "Rifresko"}
                    </button>
                </div>
            </div>

            <div className="kp-stats-grid">
                <div className="kp-card kp-stat-card kp-stat-card--blue">
                    <span className="kp-stat-label">Material pa TVSH</span>
                    <strong className="kp-stat-value">{eur(productsTotals.valueNoVat)}</strong>
                </div>

                <div className="kp-card kp-stat-card kp-stat-card--violet">
                    <span className="kp-stat-label">TVSH</span>
                    <strong className="kp-stat-value">{eur(productsTotals.vat)}</strong>
                </div>

                <div className="kp-card kp-stat-card kp-stat-card--amber">
                    <span className="kp-stat-label">Punë dore</span>
                    <strong className="kp-stat-value">{eur(laborTotal)}</strong>
                </div>

                <div className="kp-card kp-stat-card kp-stat-card--green">
                    <span className="kp-stat-label">Ngjyra</span>
                    <strong className="kp-stat-value">{eur(paint.total)}</strong>
                </div>
            </div>

            <div className="kp-main-grid">
                <div className="kp-left-stack">
                    <div className="kp-card kp-panel kp-panel--sticky">
                        <div className="kp-section-head">
                            <div>
                                <h3>Hyrjet kryesore</h3>
                                <p>Parametrat bazë për kalkulim.</p>
                            </div>
                        </div>

                        <div className="kp-field">
                            <label className="kp-label">Sipërfaqja m²</label>
                            <input
                                className="kp-input"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="p.sh. 100"
                                value={m2}
                                onChange={(e) => setM2(e.target.value)}
                            />
                        </div>

                        <div className="kp-toggle-list">
                            <label className="kp-toggle-card">
                                <input
                                    type="checkbox"
                                    checked={includePaint}
                                    onChange={(e) => setIncludePaint(e.target.checked)}
                                />
                                <div className="kp-toggle-card__content">
                                    <strong>Përfshi ngjyrën</strong>
                                    <span>Ngjyra hyn automatikisht në totalin final.</span>
                                </div>
                            </label>

                            <label className="kp-toggle-card">
                                <input
                                    type="checkbox"
                                    checked={useFixedLabor}
                                    onChange={(e) => setUseFixedLabor(e.target.checked)}
                                />
                                <div className="kp-toggle-card__content">
                                    <strong>Punë dore fikse</strong>
                                    <span>Përdor vlerë fikse në vend të llogaritjes automatike.</span>
                                </div>
                            </label>
                        </div>

                        {useFixedLabor ? (
                            <div className="kp-field">
                                <label className="kp-label">Vlera fikse e punës</label>
                                <input
                                    className="kp-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    value={fixedLaborValue}
                                    onChange={(e) => setFixedLaborValue(e.target.value)}
                                />
                            </div>
                        ) : null}

                        <div className="kp-info-card">
                            <div className="kp-info-card__title">Info e shpejtë</div>

                            <div className="kp-info-row">
                                <span>Kategoria e punës</span>
                                <strong>{laborCategory}</strong>
                            </div>

                            <div className="kp-info-row">
                                <span>Artikulli i gjetur</span>
                                <strong>{laborItemName}</strong>
                            </div>

                            <div className="kp-info-row">
                                <span>Produkte aktive</span>
                                <strong>{selectedProducts.length}</strong>
                            </div>

                            <div className="kp-info-row">
                                <span>Artikuj në qmimore</span>
                                <strong>{qmimorja.length}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="kp-card kp-panel">
                        <div className="kp-section-head">
                            <div>
                                <h3>Produktet për kalkulim</h3>
                                <p>Zgjedh produktet që do me i përfshi në kalkulim.</p>
                            </div>
                        </div>

                        <div className="kp-checkbox-list">
                            {customProducts.length > 0 ? (
                                customProducts.map((item) => {
                                    const checked = selectedProductIds.includes(item.id);

                                    return (
                                        <label
                                            key={item.id}
                                            className={`kp-check-row ${checked ? "is-checked" : ""}`}
                                        >
                                            <div className="kp-check-left">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => handleToggleProduct(item.id)}
                                                />
                                                <div className="kp-check-text">
                                                    <strong>{item.emertimi || "Pa emër"}</strong>
                                                    <span>
                                                        {item.kodi || "Pa kod"} · {item.pako || "Pa pako"} · Sasia/100m²:{" "}
                                                        {item.sasiaPer100m2}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="kp-check-prices">
                                                <span>Pa TVSH: {eur(item.vleraPer100m2)}</span>
                                                <span>TVSH: {eur(item.tvshPer100m2)}</span>
                                            </div>
                                        </label>
                                    );
                                })
                            ) : (
                                <div className="kp-empty-box">
                                    Nuk ka ende produkte. Shto produkt nga menuja anash.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="kp-right-stack">
                    <div className="kp-card kp-total-card">
                        <div className="kp-total-card__top">
                            <div>
                                <h3>Përmbledhje totale</h3>
                                <p>Totali final i materialit, TVSH-së, punës dhe ngjyrës.</p>
                            </div>

                            <div className="kp-grand-total">{eur(grandTotal)}</div>
                        </div>

                        <div className="kp-summary-grid">
                            <div className="kp-summary-box">
                                <span>Sipërfaqja</span>
                                <strong>{area.toFixed(2)} m²</strong>
                            </div>

                            <div className="kp-summary-box">
                                <span>Litra ngjyrë</span>
                                <strong>{paint.liters.toFixed(2)} L</strong>
                            </div>

                            <div className="kp-summary-box">
                                <span>Kova</span>
                                <strong>{paint.buckets}</strong>
                            </div>

                            <div className="kp-summary-box">
                                <span>Artikull pune</span>
                                <strong>{laborItemName}</strong>
                            </div>
                        </div>

                        <div className="kp-total-breakdown">
                            <div className="kp-breakdown-row">
                                <span>Material pa TVSH</span>
                                <strong>{eur(productsTotals.valueNoVat)}</strong>
                            </div>
                            <div className="kp-breakdown-row">
                                <span>TVSH</span>
                                <strong>{eur(productsTotals.vat)}</strong>
                            </div>
                            <div className="kp-breakdown-row">
                                <span>Punë dore</span>
                                <strong>{eur(laborTotal)}</strong>
                            </div>
                            <div className="kp-breakdown-row">
                                <span>Ngjyra</span>
                                <strong>{eur(paint.total)}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="kp-card kp-panel">
                        <div className="kp-section-head">
                            <div>
                                <h3>Produktet e kalkulimit</h3>
                                <p>Artikujt e llogaritur sipas sipërfaqes dhe produkteve aktive.</p>
                            </div>
                        </div>

                        <div className="kp-table-wrap">
                            <table className="kp-table">
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
                                    {productRows.length > 0 ? (
                                        productRows.map((row) => (
                                            <tr key={row.id}>
                                                <td>{row.kodi}</td>
                                                <td>{row.emertimi}</td>
                                                <td>{row.pako}</td>
                                                <td>{row.qty.toFixed(2)}</td>
                                                <td>{eur(row.valueNoVat)}</td>
                                                <td>{eur(row.vat)}</td>
                                                <td className="kp-table-total">{eur(row.total)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="kp-table-empty">
                                                {area <= 0
                                                    ? "Shkruaj një sipërfaqe më të madhe se 0 për të parë llogaritjen."
                                                    : "Nuk ka produkte aktive për kalkulim."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>

                                {productRows.length > 0 ? (
                                    <tfoot>
                                        <tr>
                                            <th colSpan={4}>Totali</th>
                                            <th>{eur(productsTotals.valueNoVat)}</th>
                                            <th>{eur(productsTotals.vat)}</th>
                                            <th>{eur(productsTotals.total)}</th>
                                        </tr>
                                    </tfoot>
                                ) : null}
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <style>{styles}</style>
        </div>
    );
}

const styles = `
  .kalkulo-shell {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding-bottom: 24px;
  }

  .kp-card {
    position: relative;
    overflow: hidden;
    border-radius: 24px;
    padding: 22px;
    background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 10px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04);
    backdrop-filter: blur(10px);
  }

  .kp-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }

  .kp-hero--premium::before {
    content: "";
    position: absolute;
    inset: 0 auto auto 0;
    width: 240px;
    height: 240px;
    background: radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%);
    pointer-events: none;
  }

  .kp-hero__content {
    position: relative;
    z-index: 1;
    min-width: 0;
  }

  .kp-hero__topline {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .kp-meta-soft {
    font-size: 13px;
    color: rgba(255,255,255,0.68);
  }

  .kp-dot-sep {
    color: rgba(255,255,255,0.32);
  }

  .kp-title {
    margin: 0;
    font-size: clamp(28px, 4vw, 40px);
    line-height: 1.02;
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  .kp-subtitle {
    margin: 10px 0 0;
    max-width: 860px;
    color: rgba(255,255,255,0.74);
    font-size: 14px;
    line-height: 1.6;
  }

  .kp-hero__actions {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .kp-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.02em;
    background: rgba(59,130,246,0.14);
    color: #7cb3ff;
    border: 1px solid rgba(59,130,246,0.22);
  }

  .kp-pill--success {
    background: rgba(16,185,129,0.14);
    color: #34d399;
    border-color: rgba(16,185,129,0.24);
  }

  .kp-pill--danger {
    background: rgba(239,68,68,0.14);
    color: #f87171;
    border-color: rgba(239,68,68,0.24);
  }

  .kp-btn {
    appearance: none;
    border: none;
    outline: none;
    border-radius: 14px;
    min-height: 44px;
    padding: 0 16px;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    transition: 180ms ease;
  }

  .kp-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .kp-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .kp-btn-primary {
    color: white;
    background: linear-gradient(135deg, #2563eb, #3b82f6);
    box-shadow: 0 8px 22px rgba(37,99,235,0.28);
  }

  .kp-btn-secondary {
    color: white;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .kp-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .kp-stat-card {
    min-height: 120px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 14px;
  }

  .kp-stat-card::after {
    content: "";
    position: absolute;
    right: -40px;
    top: -40px;
    width: 140px;
    height: 140px;
    border-radius: 999px;
    opacity: 0.28;
    filter: blur(8px);
  }

  .kp-stat-card--blue::after { background: rgba(59,130,246,0.22); }
  .kp-stat-card--violet::after { background: rgba(139,92,246,0.22); }
  .kp-stat-card--amber::after { background: rgba(245,158,11,0.22); }
  .kp-stat-card--green::after { background: rgba(16,185,129,0.22); }

  .kp-stat-label {
    position: relative;
    z-index: 1;
    font-size: 13px;
    color: rgba(255,255,255,0.72);
    font-weight: 700;
  }

  .kp-stat-value {
    position: relative;
    z-index: 1;
    font-size: clamp(22px, 2.4vw, 30px);
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }

  .kp-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 470px) minmax(0, 1fr);
    gap: 22px;
    align-items: start;
  }

  .kp-left-stack,
  .kp-right-stack {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-width: 0;
  }

  .kp-panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .kp-panel--sticky {
    position: sticky;
    top: 16px;
  }

  .kp-section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .kp-section-head h3 {
    margin: 0;
    font-size: 19px;
    font-weight: 900;
    letter-spacing: -0.01em;
  }

  .kp-section-head p {
    margin: 6px 0 0;
    font-size: 13px;
    color: rgba(255,255,255,0.68);
    line-height: 1.55;
  }

  .kp-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .kp-label {
    font-size: 13px;
    font-weight: 800;
    color: rgba(255,255,255,0.82);
  }

  .kp-input {
    width: 100%;
    min-height: 50px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    color: white;
    padding: 0 14px;
    font-size: 14px;
    outline: none;
    transition: 180ms ease;
    box-sizing: border-box;
  }

  .kp-input::placeholder {
    color: rgba(255,255,255,0.35);
  }

  .kp-input:focus {
    border-color: rgba(59,130,246,0.5);
    box-shadow: 0 0 0 4px rgba(59,130,246,0.12);
    background: rgba(255,255,255,0.055);
  }

  .kp-toggle-list {
    display: grid;
    gap: 12px;
  }

  .kp-toggle-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border-radius: 18px;
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.06);
    cursor: pointer;
  }

  .kp-toggle-card input {
    margin-top: 3px;
    transform: scale(1.05);
  }

  .kp-toggle-card__content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kp-toggle-card__content strong {
    font-size: 14px;
  }

  .kp-toggle-card__content span {
    font-size: 13px;
    color: rgba(255,255,255,0.68);
    line-height: 1.5;
  }

  .kp-info-card {
    display: grid;
    gap: 10px;
    padding: 16px;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025));
    border: 1px solid rgba(255,255,255,0.06);
  }

  .kp-info-card__title {
    font-size: 13px;
    font-weight: 900;
    color: rgba(255,255,255,0.82);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }

  .kp-info-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px dashed rgba(255,255,255,0.06);
  }

  .kp-info-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .kp-info-row span {
    font-size: 13px;
    color: rgba(255,255,255,0.68);
  }

  .kp-info-row strong {
    text-align: right;
    font-size: 13px;
  }

  .kp-checkbox-list {
    display: grid;
    gap: 10px;
  }

  .kp-check-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.028);
    cursor: pointer;
    transition: 180ms ease;
  }

  .kp-check-row.is-checked {
    border-color: rgba(59,130,246,0.28);
    background: linear-gradient(180deg, rgba(59,130,246,0.08), rgba(59,130,246,0.04));
  }

  .kp-check-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .kp-check-left input {
    margin: 0;
  }

  .kp-check-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .kp-check-text strong {
    font-size: 14px;
  }

  .kp-check-text span {
    font-size: 12px;
    color: rgba(255,255,255,0.68);
    line-height: 1.5;
  }

  .kp-check-prices {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: right;
    flex-shrink: 0;
  }

  .kp-check-prices span {
    font-size: 12px;
    color: rgba(255,255,255,0.76);
  }

  .kp-total-card {
    display: flex;
    flex-direction: column;
    gap: 18px;
    border-radius: 28px;
    background:
      radial-gradient(circle at top right, rgba(59,130,246,0.13), transparent 28%),
      linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.035));
  }

  .kp-total-card__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .kp-total-card__top h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 900;
  }

  .kp-total-card__top p {
    margin: 6px 0 0;
    font-size: 13px;
    color: rgba(255,255,255,0.68);
    line-height: 1.5;
  }

  .kp-grand-total {
    font-size: clamp(28px, 3vw, 40px);
    font-weight: 1000;
    line-height: 1;
    letter-spacing: -0.03em;
    white-space: nowrap;
  }

  .kp-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .kp-summary-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border-radius: 18px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .kp-summary-box span {
    font-size: 12px;
    color: rgba(255,255,255,0.66);
  }

  .kp-summary-box strong {
    font-size: 15px;
    line-height: 1.35;
  }

  .kp-total-breakdown {
    display: grid;
    gap: 10px;
    padding-top: 4px;
  }

  .kp-breakdown-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px dashed rgba(255,255,255,0.06);
  }

  .kp-breakdown-row:last-child {
    border-bottom: none;
  }

  .kp-breakdown-row span {
    color: rgba(255,255,255,0.72);
    font-size: 13px;
  }

  .kp-breakdown-row strong {
    font-size: 14px;
  }

  .kp-table-wrap {
    width: 100%;
    overflow-x: auto;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
  }

  .kp-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 860px;
  }

  .kp-table thead th {
    text-align: left;
    padding: 14px 16px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(255,255,255,0.65);
    background: rgba(255,255,255,0.045);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .kp-table tbody td,
  .kp-table tfoot th,
  .kp-table tfoot td {
    padding: 15px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 14px;
    vertical-align: middle;
  }

  .kp-table tbody tr:hover {
    background: rgba(255,255,255,0.025);
  }

  .kp-table tfoot tr {
    background: rgba(255,255,255,0.05);
  }

  .kp-table tfoot th,
  .kp-table tfoot td {
    font-weight: 900;
  }

  .kp-table-total {
    font-weight: 900;
  }

  .kp-table-empty {
    text-align: center;
    color: rgba(255,255,255,0.68);
    padding: 26px 16px !important;
  }

  .kp-empty-box {
    padding: 18px;
    border-radius: 18px;
    border: 1px dashed rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.72);
    background: rgba(255,255,255,0.02);
  }

  .kp-warning-card {
    border-left: 4px solid #f59e0b;
  }

  .kp-error-card {
    border-left: 4px solid #ef4444;
  }

  .kp-error-text {
    margin-top: 12px;
    color: #fca5a5;
    font-size: 14px;
    word-break: break-word;
  }

  .skeleton {
    position: relative;
    overflow: hidden;
    background: rgba(255,255,255,0.06);
    border-radius: 14px;
  }

  .skeleton::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    animation: shimmer 1.35s infinite;
  }

  .skeleton-title { height: 30px; width: 220px; }
  .skeleton-input { height: 52px; width: 100%; }
  .skeleton-box { height: 120px; width: 100%; }
  .skeleton-stat { height: 90px; width: 100%; }
  .skeleton-table { height: 260px; width: 100%; }

  @keyframes shimmer {
    100% { transform: translateX(100%); }
  }

  @media (max-width: 1220px) {
    .kp-main-grid {
      grid-template-columns: 1fr;
    }

    .kp-panel--sticky {
      position: static;
    }
  }

  @media (max-width: 980px) {
    .kp-stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .kp-hero,
    .kp-total-card__top,
    .kp-section-head,
    .kp-check-row,
    .kp-info-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .kp-summary-grid {
      grid-template-columns: 1fr;
    }

    .kp-check-prices {
      text-align: left;
    }
  }

  @media (max-width: 640px) {
    .kp-stats-grid {
      grid-template-columns: 1fr;
    }

    .kp-card {
      padding: 18px;
      border-radius: 20px;
    }

    .kp-title {
      font-size: 30px;
    }

    .kp-grand-total {
      white-space: normal;
    }
  }
`;