import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { getOwnerId } from "../lib/auth";
import type { FirmaInfo } from "../types";

export async function getFirma(): Promise<FirmaInfo | null> {
    const uid = getOwnerId();
    const ref = doc(db, "owners", uid, "company", "profile");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        return null;
    }

    return {
        id: snap.id,
        ...(snap.data() as Omit<FirmaInfo, "id">),
    };
}

export async function saveFirma(
    payload: Omit<FirmaInfo, "id" | "createdAt" | "updatedAt" | "ownerId">
) {
    const uid = getOwnerId();
    const ref = doc(db, "owners", uid, "company", "profile");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        await setDoc(ref, {
            ...payload,
            ownerId: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return;
    }

    await updateDoc(ref, {
        ...payload,
        ownerId: uid,
        updatedAt: serverTimestamp(),
    });
}