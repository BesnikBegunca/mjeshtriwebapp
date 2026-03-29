export interface ProductCalcItem {
    id: string;
    kodi: string;
    emertimi: string;
    pako: string;
    sasiaPer100m2: number;
    vleraPer100m2: number;
    tvshPer100m2: number;
    ownerId: string;
}

export interface CalculatedProductRow {
    id: string;
    kodi: string;
    emertimi: string;
    pako: string;
    qty: number;
    valueNoVat: number;
    vat: number;
    total: number;
}