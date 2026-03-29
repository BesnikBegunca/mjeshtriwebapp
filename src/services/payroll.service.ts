import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { getOwnerId } from "../lib/auth";
import type { Worker } from "../types";

export interface PayrollEntry {
    id: string;
    workerId: string;
    month: string;
    grossSalary: number;
    employeePct: number;
    employerPct: number;
    note?: string | null;
    dailyRate: number;
    workedDaysJson?: string | null;
    netSalary: number;
    employerCost: number;
    workedDaysCount: number;
    createdAt?: unknown;
    updatedAt?: unknown;
    ownerId?: string;
}

export type SavePayrollPayload = {
    workerId: string;
    month: string;
    grossSalary: number;
    employeePct: number;
    employerPct: number;
    dailyRate: number;
    note?: string | null;
    workedDaysJson?: string | null;
};

function countWorkedDays(workedDaysJson?: string | null): number {
    if (!workedDaysJson?.trim()) return 0;

    try {
        const arr = JSON.parse(workedDaysJson);
        return Array.isArray(arr) ? arr.length : 0;
    } catch {
        return 0;
    }
}

export async function getPayrollEntriesForWorker(
    workerId: string
): Promise<PayrollEntry[]> {
    const uid = getOwnerId();

    const ref = collection(db, "owners", uid, "payroll");
    const q = query(ref, where("workerId", "==", workerId));
    const snap = await getDocs(q);

    const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PayrollEntry, "id">),
    }));

    rows.sort((a, b) => b.month.localeCompare(a.month));
    return rows;
}

export async function savePayrollEntryForWorkerMonth(
    payload: SavePayrollPayload
): Promise<void> {
    const uid = getOwnerId();

    const grossSalary = Number(payload.grossSalary || 0);
    const employeePct = Number(payload.employeePct || 0);
    const employerPct = Number(payload.employerPct || 0);
    const dailyRate = Number(payload.dailyRate || 0);

    const netSalary = grossSalary * (1 - employeePct / 100);
    const employerCost = grossSalary * (1 + employerPct / 100);
    const workedDaysCount = countWorkedDays(payload.workedDaysJson);

    const ref = collection(db, "owners", uid, "payroll");
    const q = query(
        ref,
        where("workerId", "==", payload.workerId),
        where("month", "==", payload.month)
    );
    const snap = await getDocs(q);

    const dataToSave = {
        workerId: payload.workerId,
        month: payload.month,
        grossSalary,
        employeePct,
        employerPct,
        dailyRate,
        note: payload.note ?? null,
        workedDaysJson: payload.workedDaysJson ?? null,
        netSalary,
        employerCost,
        workedDaysCount,
        ownerId: uid,
        updatedAt: serverTimestamp(),
    };

    if (!snap.empty) {
        const existingDoc = snap.docs[0];
        await updateDoc(doc(db, "owners", uid, "payroll", existingDoc.id), dataToSave);
        return;
    }

    await addDoc(collection(db, "owners", uid, "payroll"), {
        ...dataToSave,
        createdAt: serverTimestamp(),
    });
}

export async function deletePayrollEntry(id: string): Promise<void> {
    const uid = getOwnerId();
    await deleteDoc(doc(db, "owners", uid, "payroll", id));
}

export async function exportPayrollPdfForWorker(_: {
    worker: Worker;
    payroll: PayrollEntry[];
    advances?: unknown[];
}): Promise<void> {
    alert("PDF për një punëtor ende s’është lidhur.");
}

export async function exportPayrollPdfAll(_: {
    workers: Worker[];
    payrollByWorker: Record<string, PayrollEntry[]>;
    advancesByWorker?: Record<string, unknown[]>;
}): Promise<void> {
    alert("PDF për krejt punëtorët ende s’është lidhur.");
}