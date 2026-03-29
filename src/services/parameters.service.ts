import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { getOwnerId } from "../lib/auth";
import type { Parameters } from "../types";

export async function getParameters(): Promise<Parameters | null> {
    const uid = getOwnerId();
    const ref = doc(db, "owners", uid, "parameters", "main");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        return null;
    }

    return {
        id: snap.id,
        ...(snap.data() as Omit<Parameters, "id">),
    };
}

export async function saveParameters(
    payload: Omit<Parameters, "id" | "createdAt" | "updatedAt" | "ownerId">
) {
    const uid = getOwnerId();
    const ref = doc(db, "owners", uid, "parameters", "main");
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