import type {
    CalculatedProductRow,
    Parameters,
    ProductCalcItem,
    QmimorjaItem,
} from "../types";

export function normalizeText(value: string): string {
    return String(value ?? "").trim().toLowerCase();
}

export function findLaborItem(
    items: QmimorjaItem[],
    laborCategory: string
): QmimorjaItem | null {
    const normalizedCategory = normalizeText(laborCategory);

    const sameCategory = items.filter(
        (item) => normalizeText(item.category) === normalizedCategory
    );

    if (sameCategory.length === 0) {
        return null;
    }

    const perMeterSquared = sameCategory.find((item) => {
        const unit = normalizeText(item.unit);
        return unit.includes("m") || unit.includes("m2") || unit.includes("m²");
    });

    return perMeterSquared ?? sameCategory[0];
}

export function calculatePaint(m2: number, params: Parameters) {
    const safeM2 = Number.isFinite(m2) ? m2 : 0;
    const litersPer100 = Number(params.litersPer100 || 0);
    const coats = Number(params.coats || 0);
    const wastePct = Number(params.wastePct || 0);
    const bucketPrice = Number(params.bucketPrice || 0);

    const liters =
        (safeM2 * litersPer100) / 100 * coats * (1 + wastePct / 100);

    const bucketSize = 25;
    const buckets = liters > 0 ? Math.ceil(liters / bucketSize) : 0;
    const total = buckets * bucketPrice;

    return {
        liters,
        buckets,
        total,
    };
}

export function calculateLabor(
    m2: number,
    laborPrice: number,
    fixedLaborValue?: number,
    useFixedLabor?: boolean
): number {
    const safeM2 = Number.isFinite(m2) ? m2 : 0;
    const safeLaborPrice = Number(laborPrice || 0);
    const safeFixedLaborValue = Number(fixedLaborValue || 0);

    if (useFixedLabor) {
        return safeFixedLaborValue;
    }

    return safeM2 * safeLaborPrice;
}

export function calculateProducts(
    m2: number,
    products: ProductCalcItem[]
): CalculatedProductRow[] {
    const safeM2 = Number.isFinite(m2) ? m2 : 0;
    const factor = safeM2 / 100;

    return products.map((product) => {
        const qty = Number(product.sasiaPer100m2 || 0) * factor;
        const valueNoVat = Number(product.vleraPer100m2 || 0) * factor;
        const vat = Number(product.tvshPer100m2 || 0) * factor;
        const total = valueNoVat + vat;

        return {
            id: product.id,
            kodi: product.kodi,
            emertimi: product.emertimi,
            pako: product.pako,
            qty,
            valueNoVat,
            vat,
            total,
        };
    });
}

export function calculateProductsTotals(rows: CalculatedProductRow[]) {
    return rows.reduce(
        (acc, row) => {
            acc.valueNoVat += Number(row.valueNoVat || 0);
            acc.vat += Number(row.vat || 0);
            acc.total += Number(row.total || 0);
            return acc;
        },
        {
            valueNoVat: 0,
            vat: 0,
            total: 0,
        }
    );
}