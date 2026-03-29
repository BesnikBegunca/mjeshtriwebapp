import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { getOwnerId } from "../lib/auth";
import type { ProductCalcItem } from "../types";

export type CreateKalkuloProductPayload = Omit<
    ProductCalcItem,
    "id" | "ownerId"
>;

export type UpdateKalkuloProductPayload = {
    id: string;
} & Omit<ProductCalcItem, "id" | "ownerId">;

function getProductsCollection() {
    const uid = getOwnerId();
    return collection(db, "owners", uid, "kalkulo_products");
}

export async function getKalkuloProducts(): Promise<ProductCalcItem[]> {
    const uid = getOwnerId();
    const ref = getProductsCollection();
    const q = query(ref, orderBy("emertimi", "asc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
        const data = d.data() as Partial<ProductCalcItem>;

        return {
            id: d.id,
            kodi: String(data.kodi ?? ""),
            emertimi: String(data.emertimi ?? ""),
            pako: String(data.pako ?? ""),
            sasiaPer100m2: Number(data.sasiaPer100m2 ?? 0),
            vleraPer100m2: Number(data.vleraPer100m2 ?? 0),
            tvshPer100m2: Number(data.tvshPer100m2 ?? 0),
            ownerId: String(data.ownerId ?? uid),
        };
    });
}

export async function createKalkuloProduct(
    payload: CreateKalkuloProductPayload
): Promise<string> {
    const uid = getOwnerId();

    const ref = await addDoc(getProductsCollection(), {
        kodi: payload.kodi ?? "",
        emertimi: payload.emertimi ?? "",
        pako: payload.pako ?? "",
        sasiaPer100m2: Number(payload.sasiaPer100m2 ?? 0),
        vleraPer100m2: Number(payload.vleraPer100m2 ?? 0),
        tvshPer100m2: Number(payload.tvshPer100m2 ?? 0),
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return ref.id;
}

export async function updateKalkuloProduct(
    payload: UpdateKalkuloProductPayload
): Promise<void> {
    const uid = getOwnerId();
    const ref = doc(db, "owners", uid, "kalkulo_products", payload.id);

    await updateDoc(ref, {
        kodi: payload.kodi ?? "",
        emertimi: payload.emertimi ?? "",
        pako: payload.pako ?? "",
        sasiaPer100m2: Number(payload.sasiaPer100m2 ?? 0),
        vleraPer100m2: Number(payload.vleraPer100m2 ?? 0),
        tvshPer100m2: Number(payload.tvshPer100m2 ?? 0),
        updatedAt: serverTimestamp(),
    });
}

export async function removeKalkuloProduct(id: string): Promise<void> {
    const uid = getOwnerId();
    await deleteDoc(doc(db, "owners", uid, "kalkulo_products", id));
}