import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    serverTimestamp,
    where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { getOwnerId } from "../lib/auth";

export interface WorkerAdvance {
    id: string;
    workerId: string;
    month: string;
    amount: number;
    note?: string | null;
    createdAt: string;
    updatedAt?: unknown;
    ownerId?: string;
}

export interface AddAdvancePayload {
    workerId: string;
    month: string;
    amount: number;
    note?: string | null;
    createdAt: string;
}

export async function getAdvancesForWorker(
    workerId: string
): Promise<WorkerAdvance[]> {
    const uid = getOwnerId();

    const ref = collection(db, "owners", uid, "advances");
    const q = query(ref, where("workerId", "==", workerId));
    const snap = await getDocs(q);

    const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WorkerAdvance, "id">),
    }));

    rows.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return rows;
}

export async function getAdvancesForWorkerMonth(
    workerId: string,
    ym: string
): Promise<WorkerAdvance[]> {
    const uid = getOwnerId();

    const ref = collection(db, "owners", uid, "advances");
    const q = query(
        ref,
        where("workerId", "==", workerId),
        where("month", "==", ym)
    );
    const snap = await getDocs(q);

    const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WorkerAdvance, "id">),
    }));

    rows.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return rows;
}

export async function addAdvance(
    payload: AddAdvancePayload
): Promise<void> {
    const uid = getOwnerId();

    await addDoc(collection(db, "owners", uid, "advances"), {
        workerId: payload.workerId,
        month: payload.month,
        amount: Number(payload.amount || 0),
        note: payload.note ?? null,
        createdAt: payload.createdAt,
        ownerId: uid,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteAdvance(id: string): Promise<void> {
    const uid = getOwnerId();
    await deleteDoc(doc(db, "owners", uid, "advances", id));
}