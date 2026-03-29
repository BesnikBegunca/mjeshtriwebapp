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

export type CreateWorkerPayload = Omit<
    Worker,
    "id" | "createdAt" | "updatedAt" | "ownerId"
>;

export async function getWorkers(): Promise<Worker[]> {
    const uid = getOwnerId();

    const ref = collection(db, "owners", uid, "workers");
    const q = query(ref, orderBy("fullName", "asc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Worker, "id">),
    }));
}

export async function createWorker(
    payload: CreateWorkerPayload
): Promise<void> {
    const uid = getOwnerId();

    await addDoc(collection(db, "owners", uid, "workers"), {
        ...payload,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
}

export async function updateWorker(
    id: string,
    payload: Partial<CreateWorkerPayload>
): Promise<void> {
    const uid = getOwnerId();

    await updateDoc(doc(db, "owners", uid, "workers", id), {
        ...payload,
        updatedAt: serverTimestamp(),
    });
}

export async function removeWorker(id: string): Promise<void> {
    const uid = getOwnerId();
    await deleteDoc(doc(db, "owners", uid, "workers", id));
}