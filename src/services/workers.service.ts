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
import type { Worker } from "../types";

export async function getWorkers(): Promise<Worker[]> {
    const ownerId = getOwnerId();

    const ref = collection(db, "owners", ownerId, "workers");
    const q = query(ref, orderBy("fullName", "asc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Worker, "id">),
    }));
}

export async function createWorker(
    payload: Omit<Worker, "id" | "createdAt" | "updatedAt">
) {
    const ownerId = getOwnerId();

    await addDoc(collection(db, "owners", ownerId, "workers"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function updateWorker(id: string, payload: Partial<Worker>) {
    const ownerId = getOwnerId();

    await updateDoc(doc(db, "owners", ownerId, "workers", id), {
        ...payload,
        updatedAt: serverTimestamp(),
    });
}

export async function removeWorker(id: string) {
    const ownerId = getOwnerId();

    await deleteDoc(doc(db, "owners", ownerId, "workers", id));
}