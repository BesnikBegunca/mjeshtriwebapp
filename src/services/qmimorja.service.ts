import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
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

function normalizeText(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toLocaleLowerCase("sq");
}

function sortQmimorjaItems(items: QmimorjaItem[]): QmimorjaItem[] {
    return [...items].sort((a, b) => {
        const categoryCompare = normalizeText(a.category).localeCompare(
            normalizeText(b.category),
            "sq",
            { sensitivity: "base" }
        );

        if (categoryCompare !== 0) {
            return categoryCompare;
        }

        return normalizeText(a.name).localeCompare(
            normalizeText(b.name),
            "sq",
            { sensitivity: "base" }
        );
    });
}

export async function getQmimorjaItems(): Promise<QmimorjaItem[]> {
    const uid = getOwnerId();

    if (!uid) {
        throw new Error("Përdoruesi nuk u gjet. Bëj login përsëri.");
    }

    const ref = collection(db, "owners", uid, "qmimorja");
    const snap = await getDocs(ref);

    const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<QmimorjaItem, "id">),
    })) as QmimorjaItem[];

    return sortQmimorjaItems(items);
}

export async function createQmimorjaItem(
    payload: CreateQmimorjaPayload
): Promise<void> {
    const uid = getOwnerId();

    if (!uid) {
        throw new Error("Përdoruesi nuk u gjet. Bëj login përsëri.");
    }

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

    if (!uid) {
        throw new Error("Përdoruesi nuk u gjet. Bëj login përsëri.");
    }

    await updateDoc(doc(db, "owners", uid, "qmimorja", id), {
        ...payload,
        updatedAt: serverTimestamp(),
    });
}

export async function removeQmimorjaItem(id: string): Promise<void> {
    const uid = getOwnerId();

    if (!uid) {
        throw new Error("Përdoruesi nuk u gjet. Bëj login përsëri.");
    }

    await deleteDoc(doc(db, "owners", uid, "qmimorja", id));
}