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
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

type AdvanceLike = {
    id?: string;
    workerId?: string;
    month?: string;
    amount?: number;
    note?: string | null;
    createdAt?: unknown;
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

function eur(value: number): string {
    return `€ ${Number(value || 0).toFixed(2)}`;
}

function monthLabel(ym?: string | null): string {
    if (!ym) return "-";

    const names = [
        "JANAR",
        "SHKURT",
        "MARS",
        "PRILL",
        "MAJ",
        "QERSHOR",
        "KORRIK",
        "GUSHT",
        "SHTATOR",
        "TETOR",
        "NËNTOR",
        "DHJETOR",
    ];

    const [year, month] = String(ym).split("-");
    const m = Number(month);
    if (!m || m < 1 || m > 12) return String(ym);

    return `${names[m - 1]} ${year}`;
}

function safeWorkerName(worker: Worker): string {
    return String(worker.fullName || "Punëtori")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-");
}

function sumAdvances(list?: AdvanceLike[]): number {
    return (list ?? []).reduce((sum, item) => sum + Number(item?.amount || 0), 0);
}

function decodeWorkedDays(jsonText?: string | null): string[] {
    if (!jsonText?.trim()) return [];

    try {
        const arr = JSON.parse(jsonText);
        if (!Array.isArray(arr)) return [];
        return arr.map((x) => String(x));
    } catch {
        return [];
    }
}

function formatWorkedDaysShort(jsonText?: string | null): string {
    const days = decodeWorkedDays(jsonText);
    if (!days.length) return "-";

    return days
        .map((d) => {
            const [y, m, day] = d.split("-");
            if (!y || !m || !day) return d;
            return `${day}.${m}.${y}`;
        })
        .join(", ");
}

function openPdfBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function savePdfBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function addPdfHeader(doc: jsPDF, title: string, subtitle?: string) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, 14, 14);

    if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(subtitle, 14, 21);
    }

    doc.setTextColor(20, 20, 20);
}

function addSummaryBlock(
    doc: jsPDF,
    startY: number,
    items: Array<{ label: string; value: string }>
) {
    const boxWidth = 58;
    const boxHeight = 18;
    const gap = 6;

    items.forEach((item, index) => {
        const x = 14 + index * (boxWidth + gap);
        const y = startY;

        doc.setDrawColor(220, 226, 232);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, boxWidth, boxHeight, 3, 3, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(item.label, x + 3, y + 6);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(item.value, x + 3, y + 13);
    });

    doc.setTextColor(20, 20, 20);
}

async function buildPdfWorker(
    worker: Worker,
    payroll: PayrollEntry[],
    advances: AdvanceLike[] = []
): Promise<Blob> {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const sortedPayroll = [...payroll].sort((a, b) => b.month.localeCompare(a.month));

    const totalGross = sortedPayroll.reduce((sum, row) => sum + Number(row.grossSalary || 0), 0);
    const totalNet = sortedPayroll.reduce((sum, row) => sum + Number(row.netSalary || 0), 0);
    const totalEmployerCost = sortedPayroll.reduce(
        (sum, row) => sum + Number(row.employerCost || 0),
        0
    );
    const totalWorkedDays = sortedPayroll.reduce(
        (sum, row) => sum + Number(row.workedDaysCount || 0),
        0
    );
    const totalAdvances = sumAdvances(advances);

    addPdfHeader(
        pdf,
        "Raporti i Pagave",
        `Punëtori: ${worker.fullName} • Pozita: ${worker.position || "-"}`
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Data: ${new Date().toLocaleDateString("sq-AL")}`, 14, 36);
    pdf.text(`Pagesa bazë/ditë: ${eur(Number(worker.baseSalary || 0))}`, 14, 42);

    addSummaryBlock(pdf, 48, [
        { label: "Totali bruto", value: eur(totalGross) },
        { label: "Totali neto", value: eur(totalNet) },
        { label: "Kosto firmës", value: eur(totalEmployerCost) },
    ]);

    addSummaryBlock(pdf, 70, [
        { label: "Avansat", value: eur(totalAdvances) },
        { label: "Ditë pune", value: String(totalWorkedDays) },
        { label: "Rreshta rroge", value: String(sortedPayroll.length) },
    ]);

    autoTable(pdf, {
        startY: 94,
        head: [
            [
                "Muaji",
                "Ditë",
                "€/Ditë",
                "Bruto",
                "Punëtori %",
                "Firma %",
                "Neto",
                "Kosto",
            ],
        ],
        body: sortedPayroll.map((row) => [
            monthLabel(row.month),
            String(row.workedDaysCount || 0),
            eur(Number(row.dailyRate || 0)),
            eur(Number(row.grossSalary || 0)),
            `${Number(row.employeePct || 0).toFixed(0)}%`,
            `${Number(row.employerPct || 0).toFixed(0)}%`,
            eur(Number(row.netSalary || 0)),
            eur(Number(row.employerCost || 0)),
        ]),
        theme: "grid",
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: 255,
            fontStyle: "bold",
        },
        styles: {
            fontSize: 8.5,
            cellPadding: 2.3,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
    });

    let nextY = (pdf as any).lastAutoTable?.finalY ?? 100;

    if (sortedPayroll.some((x) => x.note?.trim())) {
        nextY += 8;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text("Shënime të pagave", 14, nextY);

        autoTable(pdf, {
            startY: nextY + 3,
            head: [["Muaji", "Shënimi"]],
            body: sortedPayroll
                .filter((x) => x.note?.trim())
                .map((row) => [monthLabel(row.month), row.note ?? "-"]),
            theme: "grid",
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: 255,
            },
            styles: {
                fontSize: 8.5,
                cellPadding: 2.3,
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
        });

        nextY = (pdf as any).lastAutoTable?.finalY ?? nextY + 10;
    }

    if (advances.length) {
        const sortedAdvances = [...advances].sort((a, b) => {
            const aTime = new Date(a.createdAt as any).getTime() || 0;
            const bTime = new Date(b.createdAt as any).getTime() || 0;
            return bTime - aTime;
        });

        if (nextY > 230) {
            pdf.addPage();
            nextY = 20;
        } else {
            nextY += 8;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text("Avansat", 14, nextY);

        autoTable(pdf, {
            startY: nextY + 3,
            head: [["Data", "Muaji", "Shuma", "Shënimi"]],
            body: sortedAdvances.map((item) => {
                const date = item.createdAt
                    ? new Date(item.createdAt as any).toLocaleDateString("sq-AL")
                    : "-";

                return [
                    date,
                    monthLabel(item.month ?? ""),
                    eur(Number(item.amount || 0)),
                    item.note || "-",
                ];
            }),
            theme: "grid",
            headStyles: {
                fillColor: [22, 101, 52],
                textColor: 255,
            },
            styles: {
                fontSize: 8.5,
                cellPadding: 2.3,
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
        });
    }

    return pdf.output("blob");
}

async function buildPdfAll(
    workers: Worker[],
    payrollByWorker: Record<string, PayrollEntry[]>,
    advancesByWorker: Record<string, AdvanceLike[]> = {}
): Promise<Blob> {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const totalGross = workers.reduce(
        (sum, worker) =>
            sum +
            (payrollByWorker[worker.id] ?? []).reduce(
                (inner, row) => inner + Number(row.grossSalary || 0),
                0
            ),
        0
    );

    const totalNet = workers.reduce(
        (sum, worker) =>
            sum +
            (payrollByWorker[worker.id] ?? []).reduce(
                (inner, row) => inner + Number(row.netSalary || 0),
                0
            ),
        0
    );

    const totalCost = workers.reduce(
        (sum, worker) =>
            sum +
            (payrollByWorker[worker.id] ?? []).reduce(
                (inner, row) => inner + Number(row.employerCost || 0),
                0
            ),
        0
    );

    const totalAdvancesAll = workers.reduce(
        (sum, worker) => sum + sumAdvances(advancesByWorker[worker.id] ?? []),
        0
    );

    addPdfHeader(
        pdf,
        "Raporti i Krejt Punëtorëve",
        `Gjeneruar më: ${new Date().toLocaleDateString("sq-AL")}`
    );

    addSummaryBlock(pdf, 34, [
        { label: "Totali bruto", value: eur(totalGross) },
        { label: "Totali neto", value: eur(totalNet) },
        { label: "Kosto firmës", value: eur(totalCost) },
        { label: "Avansat", value: eur(totalAdvancesAll) },
    ]);

    autoTable(pdf, {
        startY: 58,
        head: [
            [
                "Punëtori",
                "Pozita",
                "Bazë/ditë",
                "Rreshta rroge",
                "Ditë pune",
                "Bruto",
                "Neto",
                "Kosto firmës",
                "Avansat",
                "Mbeten",
                "Muaji i fundit",
            ],
        ],
        body: workers.map((worker) => {
            const payroll = [...(payrollByWorker[worker.id] ?? [])].sort((a, b) =>
                b.month.localeCompare(a.month)
            );
            const advances = advancesByWorker[worker.id] ?? [];

            const gross = payroll.reduce((sum, row) => sum + Number(row.grossSalary || 0), 0);
            const net = payroll.reduce((sum, row) => sum + Number(row.netSalary || 0), 0);
            const cost = payroll.reduce((sum, row) => sum + Number(row.employerCost || 0), 0);
            const workedDays = payroll.reduce(
                (sum, row) => sum + Number(row.workedDaysCount || 0),
                0
            );
            const advanceTotal = sumAdvances(advances);
            const remaining = Math.max(0, gross - advanceTotal);
            const lastMonth = payroll[0]?.month ?? "-";

            return [
                worker.fullName || "-",
                worker.position || "-",
                eur(Number(worker.baseSalary || 0)),
                String(payroll.length),
                String(workedDays),
                eur(gross),
                eur(net),
                eur(cost),
                eur(advanceTotal),
                eur(remaining),
                monthLabel(lastMonth),
            ];
        }),
        theme: "grid",
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: 255,
            fontStyle: "bold",
        },
        styles: {
            fontSize: 8.2,
            cellPadding: 2.2,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
    });

    return pdf.output("blob");
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

export async function exportPayrollPdfForWorker({
    worker,
    payroll,
    advances = [],
    save = false,
}: {
    worker: Worker;
    payroll: PayrollEntry[];
    advances?: AdvanceLike[];
    save?: boolean;
}): Promise<void> {
    const blob = await buildPdfWorker(worker, payroll, advances);

    if (save) {
        savePdfBlob(blob, `rroga-${safeWorkerName(worker)}.pdf`);
        return;
    }

    openPdfBlob(blob);
}

export async function exportPayrollPdfAll({
    workers,
    payrollByWorker,
    advancesByWorker = {},
    save = false,
}: {
    workers: Worker[];
    payrollByWorker: Record<string, PayrollEntry[]>;
    advancesByWorker?: Record<string, AdvanceLike[]>;
    save?: boolean;
}): Promise<void> {
    const blob = await buildPdfAll(workers, payrollByWorker, advancesByWorker);

    if (save) {
        savePdfBlob(blob, "krejt-punetoret.pdf");
        return;
    }

    openPdfBlob(blob);
}