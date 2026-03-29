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
import type { QmimorjaItem } from "../types";

export type CreateQmimorjaPayload = Omit<
    QmimorjaItem,
    "id" | "createdAt" | "updatedAt" | "ownerId"
>;

export async function getQmimorjaItems(): Promise<QmimorjaItem[]> {
    const uid = getOwnerId();

    const ref = collection(db, "owners", uid, "qmimorja");
    const q = query(ref, orderBy("category", "asc"), orderBy("name", "asc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<QmimorjaItem, "id">),
    }));
}

export async function createQmimorjaItem(
    payload: CreateQmimorjaPayload
): Promise<void> {
    const uid = getOwnerId();

    await addDoc(collection(db, "owners", uid, "qmimorja"), {
        ...payload,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function updateQmimorjaItem(
    id: string,
    payload: Partial<CreateQmimorjaPayload>
): Promise<void> {
    const uid = getOwnerId();

    await updateDoc(doc(db, "owners", uid, "qmimorja", id), {
        ...payload,
        updatedAt: serverTimestamp(),
    });
}

export async function removeQmimorjaItem(id: string): Promise<void> {
    const uid = getOwnerId();

    await deleteDoc(doc(db, "owners", uid, "qmimorja", id));
}