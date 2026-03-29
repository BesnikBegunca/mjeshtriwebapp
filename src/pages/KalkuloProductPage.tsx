import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
    createKalkuloProduct,
    updateKalkuloProduct,
} from "../services/kalkulo-products.service";
import type { ProductCalcItem } from "../types";

type Mode = "create" | "edit";

type LocationState = {
    mode?: Mode;
    product?: ProductCalcItem;
};

function safeNumber(value: string | number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

function emptyProduct(): ProductCalcItem {
    return {
        id: "",
        kodi: "",
        emertimi: "",
        pako: "",
        sasiaPer100m2: 0,
        vleraPer100m2: 0,
        tvshPer100m2: 0,
        ownerId: "",
    };
}

export default function KalkuloProductPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

    const state = (location.state as LocationState | null) ?? null;
    const mode: Mode = state?.mode === "edit" ? "edit" : "create";

    const initialProduct = useMemo(() => {
        if (mode === "edit" && state?.product) {
            return {
                ...state.product,
                kodi: String(state.product.kodi ?? ""),
                emertimi: String(state.product.emertimi ?? ""),
                pako: String(state.product.pako ?? ""),
                sasiaPer100m2: safeNumber(state.product.sasiaPer100m2),
                vleraPer100m2: safeNumber(state.product.vleraPer100m2),
                tvshPer100m2: safeNumber(state.product.tvshPer100m2),
                ownerId: String(state.product.ownerId ?? ""),
            };
        }

        return emptyProduct();
    }, [mode, state]);

    const [productForm, setProductForm] = useState<ProductCalcItem>(initialProduct);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const emertimi = String(productForm.emertimi ?? "").trim();
            if (!emertimi) {
                throw new Error("Shkruaje emërtimin e produktit.");
            }

            const payload = {
                kodi: String(productForm.kodi ?? "").trim(),
                emertimi,
                pako: String(productForm.pako ?? "").trim(),
                sasiaPer100m2: safeNumber(productForm.sasiaPer100m2),
                vleraPer100m2: safeNumber(productForm.vleraPer100m2),
                tvshPer100m2: safeNumber(productForm.tvshPer100m2),
            };

            if (mode === "edit" && productForm.id) {
                await updateKalkuloProduct({
                    id: productForm.id,
                    ...payload,
                });
                return;
            }

            await createKalkuloProduct(payload);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["kalkulo_products"] });
            navigate("/kalkulo");
        },
        onError: (error) => {
            const message =
                error instanceof Error && error.message.trim()
                    ? error.message
                    : "Ruajtja dështoi.";
            window.alert(message);
        },
    });

    const handleProductFormChange = <K extends keyof ProductCalcItem>(
        key: K,
        value: ProductCalcItem[K]
    ) => {
        setProductForm((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleSave = () => {
        saveMutation.mutate();
    };

    return (
        <div className="kpp-shell">
            <div className="kpp-card">
                <div className="kpp-hero">
                    <div className="kpp-badge">
                        {mode === "edit" ? "Ndrysho Produkt" : "Shto Produkt"}
                    </div>
                    <h1>
                        {mode === "edit"
                            ? "Ndrysho produktin e kalkulimit"
                            : "Shto produkt të kalkulimit"}
                    </h1>
                    <p>Kjo faqe ruan produktin direkt në databazë.</p>
                </div>

                <div className="kpp-grid">
                    <div className="kpp-field">
                        <label>Kodi</label>
                        <input
                            className="kpp-input"
                            value={productForm.kodi}
                            onChange={(e) => handleProductFormChange("kodi", e.target.value)}
                            placeholder="p.sh. C-03"
                        />
                    </div>

                    <div className="kpp-field">
                        <label>Emërtimi</label>
                        <input
                            className="kpp-input"
                            value={productForm.emertimi}
                            onChange={(e) => handleProductFormChange("emertimi", e.target.value)}
                            placeholder="p.sh. Fasadë Primer"
                        />
                    </div>

                    <div className="kpp-field">
                        <label>Pako</label>
                        <input
                            className="kpp-input"
                            value={productForm.pako}
                            onChange={(e) => handleProductFormChange("pako", e.target.value)}
                            placeholder="p.sh. 25L"
                        />
                    </div>

                    <div className="kpp-field">
                        <label>Sasia / 100m²</label>
                        <input
                            className="kpp-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.sasiaPer100m2}
                            onChange={(e) =>
                                handleProductFormChange("sasiaPer100m2", safeNumber(e.target.value))
                            }
                        />
                    </div>

                    <div className="kpp-field">
                        <label>Vlera pa TVSH / 100m²</label>
                        <input
                            className="kpp-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.vleraPer100m2}
                            onChange={(e) =>
                                handleProductFormChange("vleraPer100m2", safeNumber(e.target.value))
                            }
                        />
                    </div>

                    <div className="kpp-field">
                        <label>TVSH / 100m²</label>
                        <input
                            className="kpp-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.tvshPer100m2}
                            onChange={(e) =>
                                handleProductFormChange("tvshPer100m2", safeNumber(e.target.value))
                            }
                        />
                    </div>
                </div>

                <div className="kpp-actions">
                    <button
                        className="kpp-btn kpp-btn-secondary"
                        onClick={() => navigate("/kalkulo")}
                        disabled={saveMutation.isPending}
                    >
                        Anulo
                    </button>

                    <button
                        className="kpp-btn kpp-btn-primary"
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                    >
                        {saveMutation.isPending
                            ? "Duke ruajtur..."
                            : mode === "edit"
                                ? "Ruaj ndryshimet"
                                : "Ruaj produktin"}
                    </button>
                </div>
            </div>

            <style>{`
        .kpp-shell {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding-bottom: 24px;
        }

        .kpp-card {
          border-radius: 28px;
          padding: 24px;
          background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 16px 40px rgba(0,0,0,0.18);
          backdrop-filter: blur(10px);
        }

        .kpp-hero {
          margin-bottom: 22px;
        }

        .kpp-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          background: rgba(59,130,246,0.14);
          color: #93c5fd;
          border: 1px solid rgba(59,130,246,0.22);
          margin-bottom: 12px;
        }

        .kpp-hero h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.05;
          font-weight: 900;
        }

        .kpp-hero p {
          margin: 10px 0 0;
          color: rgba(255,255,255,0.72);
          font-size: 14px;
          line-height: 1.6;
          max-width: 760px;
        }

        .kpp-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .kpp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .kpp-field label {
          font-size: 13px;
          font-weight: 800;
          color: rgba(255,255,255,0.84);
        }

        .kpp-input {
          width: 100%;
          min-height: 52px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: white;
          padding: 0 14px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }

        .kpp-input:focus {
          border-color: rgba(59,130,246,0.45);
          box-shadow: 0 0 0 4px rgba(59,130,246,0.12);
        }

        .kpp-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        .kpp-btn {
          min-height: 46px;
          padding: 0 16px;
          border-radius: 14px;
          border: none;
          font-weight: 800;
          cursor: pointer;
        }

        .kpp-btn-primary {
          color: white;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
        }

        .kpp-btn-secondary {
          color: white;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.08);
        }

        @media (max-width: 820px) {
          .kpp-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .kpp-card {
            padding: 18px;
            border-radius: 22px;
          }

          .kpp-actions {
            flex-direction: column;
          }

          .kpp-btn {
            width: 100%;
          }
        }
      `}</style>
        </div>
    );
}