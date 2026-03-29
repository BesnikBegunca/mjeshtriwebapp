import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import { getKalkuloProducts } from "../services/kalkulo-products.service";

type PageState = "loading" | "ready" | "error";

function toMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) return error.message;
    return "Ndodhi një gabim gjatë ngarkimit të të dhënave.";
}

function safeNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function formatDateTime(date = new Date()): string {
    return new Intl.DateTimeFormat("sq-AL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function safeFileName(value: string): string {
    return (
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\u00C0-\u024F]+/gi, "_")
            .replace(/^_+|_+$/g, "") || "oferta"
    );
}

export function KalkuloPage() {
    const [m2, setM2] = useState("100");
    const [includePaint, setIncludePaint] = useState(true);
    const [useFixedLabor, setUseFixedLabor] = useState(false);
    const [fixedLaborValue, setFixedLaborValue] = useState("0");
    const [loadingTooLong, setLoadingTooLong] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

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

    const {
        data: customProducts = [],
        isLoading: productsLoading,
        isFetching: productsFetching,
        error: productsError,
        refetch: refetchProducts,
    } = useQuery({
        queryKey: ["kalkulo_products"],
        queryFn: async () => {
            const data = await getKalkuloProducts();
            return Array.isArray(data) ? data : [];
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 15,
        retry: 1,
        refetchOnWindowFocus: false,
    });

    const isBusy = parametersLoading || qmimorjaLoading || productsLoading;
    const isRefreshing = parametersFetching || qmimorjaFetching || productsFetching;
    const hasError = !!parametersError || !!qmimorjaError || !!productsError;

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

    useEffect(() => {
        if (!customProducts.length) {
            setSelectedProductIds([]);
            return;
        }

        setSelectedProductIds((prev) => {
            const valid = prev.filter((id) => customProducts.some((p) => p.id === id));
            if (valid.length > 0) return valid;
            return customProducts.map((p) => p.id);
        });
    }, [customProducts]);

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

    const tableRows = useMemo(() => {
        return customProducts.map((item) => {
            const checked = selectedProductIds.includes(item.id);

            let calcRow:
                | {
                    id?: string;
                    kodi?: string;
                    emertimi?: string;
                    pako?: string;
                    qty?: number;
                    valueNoVat?: number;
                    vat?: number;
                    total?: number;
                }
                | undefined;

            try {
                calcRow = area > 0 ? calculateProducts(area, [item])[0] : undefined;
            } catch {
                calcRow = undefined;
            }

            return {
                item,
                checked,
                calcRow,
            };
        });
    }, [customProducts, selectedProductIds, area]);

    const grandTotal = productsTotals.total + laborTotal + paint.total;
    const pageState: PageState = hasError ? "error" : isBusy ? "loading" : "ready";

    const handleRetryAll = async () => {
        await Promise.all([refetchParameters(), refetchQmimorja(), refetchProducts()]);
    };

    const laborCategory = parameters?.laborCategory?.trim() || "Nuk ka parametra";
    const laborItemName = laborItem?.name?.trim() || "Nuk u gjet artikulli i punës";
    const errorText = [parametersError, qmimorjaError, productsError]
        .filter(Boolean)
        .map(toMessage)
        .join(" | ");

    const handleToggleProduct = (id: string) => {
        setSelectedProductIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSaveOfferPdf = async () => {
        try {
            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const marginX = 14;
            let y = 16;

            doc.setFillColor(24, 36, 58);
            doc.roundedRect(marginX, y, pageWidth - marginX * 2, 24, 4, 4, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text("OFERTË / KALKULIM", marginX + 6, y + 9);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(`Data: ${formatDateTime()}`, marginX + 6, y + 16);
            doc.text(`Sipërfaqja: ${area.toFixed(2)} m²`, pageWidth - marginX - 45, y + 16);

            y += 32;

            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Përmbledhje", marginX, y);

            y += 4;

            autoTable(doc, {
                startY: y,
                margin: { left: marginX, right: marginX },
                theme: "grid",
                head: [["Përshkrimi", "Vlera"]],
                body: [
                    ["Sipërfaqja", `${area.toFixed(2)} m²`],
                    ["Produkte aktive", `${selectedProducts.length}`],
                    ["Material pa TVSH", eur(productsTotals.valueNoVat)],
                    ["TVSH", eur(productsTotals.vat)],
                    ["Material gjithsej", eur(productsTotals.total)],
                    ["Punë dore", eur(laborTotal)],
                    ["Ngjyra", eur(paint.total)],
                    ["Litra ngjyrë", `${safeNumber(paint.liters).toFixed(2)} L`],
                    ["Kova", `${safeNumber(paint.buckets)}`],
                    ["Artikulli i punës", laborItemName],
                    ["Totali final", eur(grandTotal)],
                ],
                styles: {
                    fontSize: 9,
                    cellPadding: 2.5,
                },
                headStyles: {
                    fillColor: [37, 99, 235],
                },
                bodyStyles: {
                    textColor: [31, 41, 55],
                },
            });

            y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
                ? (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable!.finalY! + 8
                : 90;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Produktet e kalkulimit", marginX, y);

            y += 4;

            autoTable(doc, {
                startY: y,
                margin: { left: marginX, right: marginX },
                theme: "striped",
                head: [["Kodi", "Emërtimi", "Pako", "Sasia", "Pa TVSH", "TVSH", "Totali"]],
                body:
                    productRows.length > 0
                        ? productRows.map((row) => [
                            row.kodi || "-",
                            row.emertimi || "-",
                            row.pako || "-",
                            safeNumber(row.qty).toFixed(2),
                            eur(safeNumber(row.valueNoVat)),
                            eur(safeNumber(row.vat)),
                            eur(safeNumber(row.total)),
                        ])
                        : [["-", "Nuk ka produkte aktive për kalkulim.", "-", "-", "-", "-", "-"]],
                foot:
                    productRows.length > 0
                        ? [[
                            "",
                            "",
                            "",
                            "Totali",
                            eur(productsTotals.valueNoVat),
                            eur(productsTotals.vat),
                            eur(productsTotals.total),
                        ]]
                        : undefined,
                styles: {
                    fontSize: 8.5,
                    cellPadding: 2.2,
                    overflow: "linebreak",
                },
                headStyles: {
                    fillColor: [15, 23, 42],
                },
                footStyles: {
                    fillColor: [37, 99, 235],
                },
                columnStyles: {
                    0: { cellWidth: 22 },
                    1: { cellWidth: 48 },
                    2: { cellWidth: 20 },
                    3: { cellWidth: 18, halign: "right" },
                    4: { cellWidth: 24, halign: "right" },
                    5: { cellWidth: 20, halign: "right" },
                    6: { cellWidth: 24, halign: "right" },
                },
            });

            const finalY =
                (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 240;

            doc.setFillColor(240, 249, 255);
            doc.roundedRect(marginX, finalY + 6, pageWidth - marginX * 2, 16, 3, 3, "F");

            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("TOTALI FINAL", marginX + 4, finalY + 16);

            doc.setTextColor(22, 101, 52);
            doc.setFontSize(14);
            doc.text(eur(grandTotal), pageWidth - marginX - 4, finalY + 16, {
                align: "right",
            });

            const filename = `oferta_a4_${safeFileName(
                `${area.toFixed(0)}m2_${new Date().toISOString().slice(0, 10)}`
            )}.pdf`;

            doc.save(filename);
        } catch (error) {
            console.error(error);
            window.alert("Gabim gjatë ruajtjes së PDF ofertës.");
        }
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
                <div className="kp-card kp-hero kp-hero--loading">
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
                <div className="kp-hero__glow kp-hero__glow--one" />
                <div className="kp-hero__glow kp-hero__glow--two" />

                <div className="kp-hero__content">
                    <div className="kp-hero__topline">
                        <span className="kp-pill kp-pill--success">Kalkulo</span>
                        <span className="kp-dot-sep">•</span>
                        <span className="kp-meta-soft">{selectedProducts.length} produkte aktive</span>
                        <span className="kp-dot-sep">•</span>
                        <span className="kp-meta-soft">{qmimorja.length} artikuj në qmimore</span>
                    </div>

                    <h1 className="kp-title">Ofertë dhe kalkulim premium</h1>
                    <p className="kp-subtitle">
                        Llogarit materialin, TVSH-në, punën dore dhe ngjyrën me një pamje më të pastër,
                        më moderne dhe më profesionale.
                    </p>
                </div>

                <div className="kp-hero__aside">
                    <div className="kp-hero-total-label">Totali final</div>
                    <div className="kp-hero-total-value">{eur(grandTotal)}</div>

                    <div className="kp-hero__actions">
                        <button
                            className="kp-btn kp-btn-secondary"
                            onClick={handleRetryAll}
                            disabled={isRefreshing}
                        >
                            {isRefreshing ? "Duke rifreskuar..." : "Rifresko"}
                        </button>

                        <button className="kp-btn kp-btn-primary" onClick={handleSaveOfferPdf}>
                            Save A4 PDF – Oferta
                        </button>
                    </div>
                </div>
            </div>

            <div className="kp-main-grid">
                <div className="kp-left-stack">
                    <div className="kp-card kp-panel kp-panel--sticky kp-inputs-card">
                        <div className="kp-section-head">
                            <div>
                                <h3>Hyrjet kryesore</h3>
                                <p>Vendos parametrat bazë për kalkulim.</p>
                            </div>
                        </div>

                        <div className="kp-input-hero">
                            <div className="kp-input-hero__label">Sipërfaqja totale</div>
                            <div className="kp-input-hero__row">
                                <input
                                    className="kp-input kp-input--xl"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="p.sh. 100"
                                    value={m2}
                                    onChange={(e) => setM2(e.target.value)}
                                />
                                <div className="kp-unit-badge">m²</div>
                            </div>
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
                                    <span>Ngjyra shtohet automatikisht në totalin final.</span>
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
                            <div className="kp-info-card__title">Detaje të shpejta</div>

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
                </div>

                <div className="kp-right-stack">
                    <div className="kp-card kp-total-card">
                        <div className="kp-total-card__top">
                            <div>
                                <h3>Përmbledhje totale</h3>
                                <p>Gjithçka e rëndësishme në një kartë të vetme.</p>
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

                            <div className="kp-summary-box">
                                <span>Produkte aktive</span>
                                <strong>{selectedProducts.length}</strong>
                            </div>

                            <div className="kp-summary-box">
                                <span>Material gjithsej</span>
                                <strong>{eur(productsTotals.total)}</strong>
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
                                <span>Produktet e kalkulimit</span>
                                <strong>{eur(productsTotals.total)}</strong>
                            </div>
                            <div className="kp-breakdown-row">
                                <span>Punë dore</span>
                                <strong>{eur(laborTotal)}</strong>
                            </div>
                            <div className="kp-breakdown-row">
                                <span>Ngjyra</span>
                                <strong>{eur(paint.total)}</strong>
                            </div>
                            <div className="kp-breakdown-row kp-breakdown-row--grand">
                                <span>Totali final</span>
                                <strong>{eur(grandTotal)}</strong>
                            </div>
                        </div>

                        <div className="kp-products-summary">
                            <div className="kp-products-summary__head">
                                <h4>Produktet e përfshira në total</h4>
                                <span>{selectedProducts.length} aktive</span>
                            </div>

                            {productRows.length > 0 ? (
                                <div className="kp-mini-products">
                                    {productRows.map((row) => (
                                        <div key={row.id} className="kp-mini-product">
                                            <div className="kp-mini-product__left">
                                                <strong>{row.emertimi || "Pa emër"}</strong>
                                                <span>
                                                    {row.kodi || "Pa kod"} · {row.pako || "Pa pako"} ·{" "}
                                                    Sasia: {safeNumber(row.qty).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="kp-mini-product__right">
                                                {eur(safeNumber(row.total))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="kp-empty-box">
                                    {area <= 0
                                        ? "Shkruaj një sipërfaqe më të madhe se 0."
                                        : "Nuk ka produkte aktive në përmbledhje."}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="kp-card kp-panel kp-table-card">
                        <div className="kp-section-head">
                            <div>
                                <h3>Produktet e kalkulimit</h3>
                                <p>Check / uncheck direkt në tabelë.</p>
                            </div>
                        </div>

                        <div className="kp-table-wrap">
                            <table className="kp-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "70px" }}>On</th>
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
                                    {tableRows.length > 0 ? (
                                        tableRows.map(({ item, checked, calcRow }) => (
                                            <tr
                                                key={item.id}
                                                className={checked ? "kp-row-active" : ""}
                                            >
                                                <td>
                                                    <label className="kp-table-check">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => handleToggleProduct(item.id)}
                                                        />
                                                        <span className="kp-check-slider" />
                                                    </label>
                                                </td>
                                                <td>{item.kodi || "-"}</td>
                                                <td>{item.emertimi || "-"}</td>
                                                <td>{item.pako || "-"}</td>
                                                <td>{calcRow ? safeNumber(calcRow.qty).toFixed(2) : "-"}</td>
                                                <td>{calcRow ? eur(safeNumber(calcRow.valueNoVat)) : "-"}</td>
                                                <td>{calcRow ? eur(safeNumber(calcRow.vat)) : "-"}</td>
                                                <td className="kp-table-total">
                                                    {calcRow ? eur(safeNumber(calcRow.total)) : "-"}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="kp-table-empty">
                                                Nuk ka ende produkte të kalkulimit.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>

                                {productRows.length > 0 ? (
                                    <tfoot>
                                        <tr>
                                            <th colSpan={5}>Totali i produkteve aktive</th>
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
    padding-bottom: 28px;
    color: #fff;
  }

  .kp-card {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    padding: 24px;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
    border: 1px solid rgba(255,255,255,0.10);
    box-shadow:
      0 18px 45px rgba(0,0,0,0.28),
      inset 0 1px 0 rgba(255,255,255,0.05);
    backdrop-filter: blur(14px);
  }

  .kp-hero {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 18px;
  }

  .kp-hero--premium {
    min-height: 220px;
    background:
      radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%),
      radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 26%),
      linear-gradient(135deg, rgba(15,23,42,0.96), rgba(17,24,39,0.88));
    border-color: rgba(255,255,255,0.08);
  }

  .kp-hero--loading {
    min-height: 150px;
  }

  .kp-hero__glow {
    position: absolute;
    border-radius: 999px;
    filter: blur(18px);
    opacity: 0.5;
    pointer-events: none;
  }

  .kp-hero__glow--one {
    width: 180px;
    height: 180px;
    left: -20px;
    top: -30px;
    background: rgba(59,130,246,0.22);
  }

  .kp-hero__glow--two {
    width: 200px;
    height: 200px;
    right: -30px;
    bottom: -50px;
    background: rgba(16,185,129,0.14);
  }

  .kp-hero__content {
    position: relative;
    z-index: 1;
    min-width: 0;
    flex: 1;
  }

  .kp-hero__aside {
    position: relative;
    z-index: 1;
    min-width: 280px;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 14px;
    padding: 18px;
    border-radius: 24px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
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
    color: rgba(255,255,255,0.70);
  }

  .kp-dot-sep {
    color: rgba(255,255,255,0.30);
  }

  .kp-title {
    margin: 0;
    font-size: clamp(30px, 4vw, 42px);
    line-height: 1.02;
    font-weight: 900;
    letter-spacing: -0.03em;
  }

  .kp-subtitle {
    margin: 12px 0 0;
    max-width: 760px;
    color: rgba(255,255,255,0.76);
    font-size: 14px;
    line-height: 1.7;
  }

  .kp-hero-total-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(255,255,255,0.58);
    font-weight: 800;
  }

  .kp-hero-total-value {
    font-size: clamp(28px, 3vw, 38px);
    line-height: 1;
    font-weight: 900;
    color: #86efac;
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
    border-radius: 16px;
    min-height: 46px;
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
    box-shadow: 0 10px 24px rgba(37,99,235,0.30);
  }

  .kp-btn-secondary {
    color: white;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .kp-main-grid {
    display: grid;
    grid-template-columns: 370px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .kp-left-stack,
  .kp-right-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  .kp-panel--sticky {
    position: sticky;
    top: 16px;
  }

  .kp-inputs-card {
    background:
      linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.035));
  }

  .kp-section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .kp-section-head h3 {
    margin: 0;
    font-size: 19px;
    font-weight: 900;
  }

  .kp-section-head p {
    margin: 6px 0 0;
    color: rgba(255,255,255,0.68);
    font-size: 13px;
    line-height: 1.6;
  }

  .kp-input-hero {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 20px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .kp-input-hero__label {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 800;
    color: rgba(255,255,255,0.76);
  }

  .kp-input-hero__row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .kp-unit-badge {
    min-width: 66px;
    height: 52px;
    border-radius: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(37,99,235,0.15);
    border: 1px solid rgba(59,130,246,0.20);
    color: #bfdbfe;
    font-weight: 900;
    font-size: 15px;
  }

  .kp-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }

  .kp-label {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.82);
  }

  .kp-input {
    width: 100%;
    min-height: 48px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.06);
    color: white;
    padding: 0 14px;
    outline: none;
    font-size: 14px;
  }

  .kp-input--xl {
    min-height: 54px;
    font-size: 18px;
    font-weight: 800;
    padding: 0 16px;
  }

  .kp-input::placeholder {
    color: rgba(255,255,255,0.40);
  }

  .kp-input:focus {
    border-color: rgba(59,130,246,0.52);
    box-shadow: 0 0 0 4px rgba(59,130,246,0.12);
  }

  .kp-toggle-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 14px;
  }

  .kp-toggle-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 15px;
    border-radius: 18px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    cursor: pointer;
    transition: 180ms ease;
  }

  .kp-toggle-card:hover {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.10);
  }

  .kp-toggle-card input {
    margin-top: 2px;
    transform: scale(1.08);
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
    font-size: 12px;
    color: rgba(255,255,255,0.66);
    line-height: 1.55;
  }

  .kp-info-card {
    margin-top: 12px;
    padding: 16px;
    border-radius: 20px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .kp-info-card__title {
    font-size: 13px;
    font-weight: 900;
    margin-bottom: 10px;
    color: rgba(255,255,255,0.86);
  }

  .kp-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .kp-info-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .kp-info-row span {
    color: rgba(255,255,255,0.68);
    font-size: 13px;
  }

  .kp-info-row strong {
    font-size: 13px;
    text-align: right;
  }

  .kp-total-card {
    background:
      radial-gradient(circle at top right, rgba(37,99,235,0.12), transparent 24%),
      linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
  }

  .kp-total-card__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  .kp-total-card__top h3 {
    margin: 0;
    font-size: 21px;
    font-weight: 900;
  }

  .kp-total-card__top p {
    margin: 6px 0 0;
    color: rgba(255,255,255,0.68);
    font-size: 13px;
    line-height: 1.55;
  }

  .kp-grand-total {
    font-size: clamp(28px, 4vw, 36px);
    font-weight: 900;
    line-height: 1;
    color: #86efac;
    white-space: nowrap;
  }

  .kp-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .kp-summary-box {
    padding: 15px;
    border-radius: 18px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .kp-summary-box span {
    font-size: 12px;
    color: rgba(255,255,255,0.65);
  }

  .kp-summary-box strong {
    font-size: 14px;
    line-height: 1.45;
  }

  .kp-total-breakdown {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 18px;
  }

  .kp-breakdown-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 13px 15px;
    border-radius: 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.05);
  }

  .kp-breakdown-row span {
    color: rgba(255,255,255,0.70);
    font-size: 13px;
  }

  .kp-breakdown-row strong {
    font-size: 14px;
  }

  .kp-breakdown-row--grand {
    background: rgba(34,197,94,0.08);
    border-color: rgba(34,197,94,0.20);
  }

  .kp-products-summary {
    padding-top: 4px;
  }

  .kp-products-summary__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .kp-products-summary__head h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 900;
  }

  .kp-products-summary__head span {
    font-size: 12px;
    color: rgba(255,255,255,0.70);
  }

  .kp-mini-products {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .kp-mini-product {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 15px;
    border-radius: 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .kp-mini-product__left {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kp-mini-product__left strong {
    font-size: 14px;
  }

  .kp-mini-product__left span {
    color: rgba(255,255,255,0.65);
    font-size: 12px;
    line-height: 1.5;
  }

  .kp-mini-product__right {
    white-space: nowrap;
    font-size: 14px;
    font-weight: 900;
    color: #93c5fd;
  }

  .kp-table-card {
    background:
      linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
  }

  .kp-table-wrap {
    width: 100%;
    overflow-x: auto;
  }

  .kp-table {
    width: 100%;
    min-width: 900px;
    border-collapse: separate;
    border-spacing: 0;
  }

  .kp-table thead th {
    text-align: left;
    font-size: 12px;
    color: rgba(255,255,255,0.76);
    font-weight: 900;
    padding: 14px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    white-space: nowrap;
    background: rgba(255,255,255,0.02);
  }

  .kp-table thead th:first-child {
    border-top-left-radius: 14px;
  }

  .kp-table thead th:last-child {
    border-top-right-radius: 14px;
  }

  .kp-table tbody td,
  .kp-table tfoot th,
  .kp-table tfoot td {
    padding: 14px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: 13px;
    vertical-align: middle;
  }

  .kp-table tbody tr {
    transition: background 180ms ease;
  }

  .kp-table tbody tr:hover {
    background: rgba(255,255,255,0.03);
  }

  .kp-table-total {
    font-weight: 900;
    color: #86efac;
  }

  .kp-row-active {
    background: rgba(37,99,235,0.08);
  }

  .kp-table-check {
    position: relative;
    display: inline-flex;
    width: 46px;
    height: 28px;
    cursor: pointer;
  }

  .kp-table-check input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .kp-check-slider {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.12);
    transition: all 180ms ease;
  }

  .kp-check-slider::before {
    content: "";
    position: absolute;
    width: 20px;
    height: 20px;
    left: 3px;
    top: 3px;
    border-radius: 999px;
    background: #fff;
    transition: transform 180ms ease;
    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
  }

  .kp-table-check input:checked + .kp-check-slider {
    background: linear-gradient(135deg, #2563eb, #3b82f6);
    border-color: rgba(59,130,246,0.4);
  }

  .kp-table-check input:checked + .kp-check-slider::before {
    transform: translateX(18px);
  }

  .kp-table tfoot th,
  .kp-table tfoot td {
    font-weight: 900;
    color: #fff;
    background: rgba(37,99,235,0.12);
  }

  .kp-table-empty,
  .kp-empty-box {
    text-align: center;
    color: rgba(255,255,255,0.65);
    padding: 18px;
    border-radius: 14px;
  }

  .kp-empty-box {
    background: rgba(255,255,255,0.04);
    border: 1px dashed rgba(255,255,255,0.08);
  }

  .kp-warning-card {
    border-color: rgba(245,158,11,0.24);
    background: rgba(245,158,11,0.08);
  }

  .kp-warning-card strong {
    display: block;
    margin-bottom: 6px;
  }

  .kp-error-text {
    margin-top: 10px;
    color: #fecaca;
    font-size: 13px;
    line-height: 1.6;
  }

  .skeleton {
    border-radius: 14px;
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.05) 25%,
      rgba(255,255,255,0.10) 37%,
      rgba(255,255,255,0.05) 63%
    );
    background-size: 400% 100%;
    animation: kpShimmer 1.4s ease infinite;
  }

  .skeleton-title { height: 24px; width: 180px; margin-bottom: 12px; }
  .skeleton-input { height: 48px; width: 100%; margin-bottom: 12px; }
  .skeleton-box { height: 180px; width: 100%; }
  .skeleton-table { height: 280px; width: 100%; }

  @keyframes kpShimmer {
    0% { background-position: 100% 0; }
    100% { background-position: 0 0; }
  }

  @media (max-width: 1180px) {
    .kp-main-grid {
      grid-template-columns: 1fr;
    }

    .kp-panel--sticky {
      position: static;
      top: auto;
    }

    .kp-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 920px) {
    .kp-hero {
      flex-direction: column;
      align-items: stretch;
    }

    .kp-hero__aside {
      max-width: none;
      min-width: 0;
    }
  }

  @media (max-width: 640px) {
    .kp-card {
      padding: 16px;
      border-radius: 22px;
    }

    .kp-summary-grid {
      grid-template-columns: 1fr;
    }

    .kp-total-card__top {
      flex-direction: column;
      align-items: flex-start;
    }

    .kp-grand-total {
      white-space: normal;
    }

    .kp-btn {
      width: 100%;
    }

    .kp-hero__actions {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }

    .kp-input-hero__row {
      flex-direction: column;
      align-items: stretch;
    }

    .kp-unit-badge {
      width: 100%;
    }

    .kp-table {
      min-width: 760px;
    }

    .kp-mini-product,
    .kp-breakdown-row,
    .kp-info-row,
    .kp-products-summary__head {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`;