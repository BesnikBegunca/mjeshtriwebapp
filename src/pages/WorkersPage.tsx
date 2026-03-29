import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eur } from "../lib/money";
import {
    createWorker,
    getWorkers,
    removeWorker,
    type CreateWorkerPayload,
} from "../services/workers.service";
import {
    getPayrollEntriesForWorker,
    savePayrollEntryForWorkerMonth,
    exportPayrollPdfAll,
    exportPayrollPdfForWorker,
    type PayrollEntry,
    type SavePayrollPayload,
} from "../services/payroll.service";
import {
    getAdvancesForWorker,
    getAdvancesForWorkerMonth,
    addAdvance,
    deleteAdvance,
    type WorkerAdvance,
    type AddAdvancePayload,
} from "../services/advances.service";
import type { Worker } from "../types";

const MONTH_NAMES = [
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

type PayrollMap = Record<string, PayrollEntry[]>;
type AdvanceMap = Record<string, WorkerAdvance[]>;

function ymNow() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ymFromYearMonth(year: number, month: number) {
    return `${year}-${String(month).padStart(2, "0")}`;
}

function monthFromYm(ym: string) {
    const parts = ym.split("-");
    return Number(parts[1] || new Date().getMonth() + 1);
}

function yearFromYm(ym: string) {
    const parts = ym.split("-");
    return Number(parts[0] || new Date().getFullYear());
}

function monthLabel(ym: string) {
    const month = monthFromYm(ym);
    const year = yearFromYm(ym);
    return `${MONTH_NAMES[month - 1] ?? ym} ${year}`;
}

function dateOnly(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDate(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function encodeWorkedDays(days: Date[]) {
    return JSON.stringify(
        days
            .map((d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                return `${y}-${m}-${day}`;
            })
            .sort()
    );
}

function decodeWorkedDays(jsonText?: string | null): Date[] {
    if (!jsonText?.trim()) return [];
    try {
        const arr = JSON.parse(jsonText);
        if (!Array.isArray(arr)) return [];
        return arr.map((x) => {
            const [y, m, d] = String(x).split("-").map(Number);
            return new Date(y, (m || 1) - 1, d || 1);
        });
    } catch {
        return [];
    }
}

function isSunday(d: Date) {
    return d.getDay() === 0;
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

function sumAdvances(list: WorkerAdvance[]) {
    return list.reduce((sum, a) => sum + (a.amount || 0), 0);
}

function grossForWorker(entries: PayrollEntry[]) {
    return entries.reduce((sum, e) => sum + (e.grossSalary || 0), 0);
}

function netForWorker(entries: PayrollEntry[]) {
    return entries.reduce((sum, e) => sum + (e.netSalary || 0), 0);
}

function costForWorker(entries: PayrollEntry[]) {
    return entries.reduce((sum, e) => sum + (e.employerCost || 0), 0);
}

function workedDaysForWorker(entries: PayrollEntry[]) {
    return entries.reduce((sum, e) => sum + (e.workedDaysCount || 0), 0);
}

function latestPayroll(entries: PayrollEntry[]) {
    if (!entries.length) return null;
    return [...entries].sort((a, b) => b.month.localeCompare(a.month))[0];
}

function entryForMonth(entries: PayrollEntry[], ym: string) {
    return entries.find((e) => e.month === ym) ?? null;
}

export function WorkersPage() {
    const qc = useQueryClient();

    const [showAddWorker, setShowAddWorker] = useState(false);
    const [payrollWorker, setPayrollWorker] = useState<Worker | null>(null);
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    const [newWorkerName, setNewWorkerName] = useState("");
    const [newWorkerPosition, setNewWorkerPosition] = useState("Punëtor");
    const [newWorkerDailyRate, setNewWorkerDailyRate] = useState("35");

    const { data: workers = [], isLoading: workersLoading } = useQuery({
        queryKey: ["workers"],
        queryFn: getWorkers,
    });

    const { data: payrollData = {} } = useQuery<PayrollMap>({
        queryKey: ["workers", "payroll-map", workers.map((w) => w.id).join(",")],
        enabled: workers.length > 0,
        queryFn: async () => {
            const entries = await Promise.all(
                workers.map(async (w) => {
                    const rows = await getPayrollEntriesForWorker(w.id);
                    return [w.id, rows.sort((a, b) => b.month.localeCompare(a.month))] as const;
                })
            );
            return Object.fromEntries(entries);
        },
    });

    const { data: advancesData = {} } = useQuery<AdvanceMap>({
        queryKey: ["workers", "advance-map", workers.map((w) => w.id).join(",")],
        enabled: workers.length > 0,
        queryFn: async () => {
            const entries = await Promise.all(
                workers.map(async (w) => {
                    const rows = await getAdvancesForWorker(w.id);
                    return [
                        w.id,
                        rows.sort(
                            (a, b) =>
                                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                        ),
                    ] as const;
                })
            );
            return Object.fromEntries(entries);
        },
    });

    const addWorkerMutation = useMutation<void, Error, CreateWorkerPayload>({
        mutationFn: createWorker,
        onSuccess: async () => {
            setShowAddWorker(false);
            setNewWorkerName("");
            setNewWorkerPosition("Punëtor");
            setNewWorkerDailyRate("35");
            await qc.invalidateQueries({ queryKey: ["workers"] });
        },
    });

    const deleteWorkerMutation = useMutation<void, Error, string>({
        mutationFn: removeWorker,
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["workers"] });
            await qc.invalidateQueries({ queryKey: ["workers", "payroll-map"] });
            await qc.invalidateQueries({ queryKey: ["workers", "advance-map"] });
        },
    });

    const totalGrossAll = useMemo(
        () => workers.reduce((sum, w) => sum + grossForWorker(payrollData[w.id] ?? []), 0),
        [workers, payrollData]
    );

    const totalNetAll = useMemo(
        () => workers.reduce((sum, w) => sum + netForWorker(payrollData[w.id] ?? []), 0),
        [workers, payrollData]
    );

    const totalCostAll = useMemo(
        () => workers.reduce((sum, w) => sum + costForWorker(payrollData[w.id] ?? []), 0),
        [workers, payrollData]
    );

    const totalAdvancesAll = useMemo(
        () => workers.reduce((sum, w) => sum + sumAdvances(advancesData[w.id] ?? []), 0),
        [workers, advancesData]
    );

    const totalWorkedDaysAll = useMemo(
        () => workers.reduce((sum, w) => sum + workedDaysForWorker(payrollData[w.id] ?? []), 0),
        [workers, payrollData]
    );

    function toggleStats(workerId: string) {
        setExpandedIds((prev) =>
            prev.includes(workerId) ? prev.filter((x) => x !== workerId) : [...prev, workerId]
        );
    }

    function submitAddWorker(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!newWorkerName.trim()) return;

        addWorkerMutation.mutate({
            fullName: newWorkerName.trim(),
            position: newWorkerPosition.trim() || "Punëtor",
            baseSalary: Number(newWorkerDailyRate || 35),
        });
    }

    async function handleDeleteWorker(worker: Worker) {
        const payrollRows = payrollData[worker.id] ?? [];
        const message = payrollRows.length
            ? `Punëtori "${worker.fullName}" ka ${payrollRows.length} rroga të regjistruara. Nëse vazhdon, do të fshihen edhe rrogat e tij. A don me vazhdu?`
            : `A je i sigurt që don me fshi punëtorin "${worker.fullName}"?`;

        if (!window.confirm(message)) return;
        deleteWorkerMutation.mutate(worker.id);
    }

    async function handleExportAll() {
        await exportPayrollPdfAll({
            workers,
            payrollByWorker: payrollData,
            advancesByWorker: advancesData,
        });
    }

    if (workersLoading) {
        return (
            <div className="card">
                <p>Duke i ngarkuar punëtorët...</p>
            </div>
        );
    }

    return (
        <>
            <div className="stack-lg">
                <div className="row-between" style={{ gap: 12, flexWrap: "wrap" }}>
                    <div>
                        <h2 style={{ margin: 0 }}>Evidenca e Punëtorëve</h2>
                        <p style={{ marginTop: 6, color: "#94a3b8" }}>
                            Rroga mujore, avansa, ditë pune dhe raportet PDF.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                            className="button"
                            onClick={handleExportAll}
                            disabled={workers.length === 0}
                        >
                            PDF (krejt)
                        </button>
                        <button className="button primary" onClick={() => setShowAddWorker(true)}>
                            Shto punëtor
                        </button>
                    </div>
                </div>

                <div className="stats-grid">
                    <div className="card stat-card">
                        <span className="stat-title">Totali bruto</span>
                        <div className="stat-value">{eur(totalGrossAll)}</div>
                    </div>
                    <div className="card stat-card">
                        <span className="stat-title">Totali neto</span>
                        <div className="stat-value">{eur(totalNetAll)}</div>
                    </div>
                    <div className="card stat-card">
                        <span className="stat-title">Kosto firmës</span>
                        <div className="stat-value">{eur(totalCostAll)}</div>
                    </div>
                    <div className="card stat-card">
                        <span className="stat-title">Avansat</span>
                        <div className="stat-value">{eur(totalAdvancesAll)}</div>
                    </div>
                </div>

                <div className="card">
                    <div className="row-between">
                        <strong>Ditë të punuara</strong>
                        <strong>{totalWorkedDaysAll}</strong>
                    </div>
                </div>

                {workers.length === 0 ? (
                    <div className="card">
                        <p>Nuk ka punëtorë të regjistruar.</p>
                    </div>
                ) : (
                    <div className="stack-md">
                        {workers.map((worker) => {
                            const payrollEntries = payrollData[worker.id] ?? [];
                            const advances = advancesData[worker.id] ?? [];
                            const latest = latestPayroll(payrollEntries);
                            const currentMonthEntry = entryForMonth(payrollEntries, ymNow());
                            const isExpanded = expandedIds.includes(worker.id);

                            return (
                                <div className="card" key={worker.id}>
                                    <div className="row-between" style={{ alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                                        <div style={{ display: "flex", gap: 14 }}>
                                            <div
                                                style={{
                                                    width: 52,
                                                    height: 52,
                                                    borderRadius: 18,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    fontWeight: 900,
                                                    background: "rgba(34,197,94,.12)",
                                                    color: "#86efac",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {worker.fullName?.[0]?.toUpperCase() ?? "?"}
                                            </div>

                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: 18 }}>{worker.fullName}</div>
                                                <div style={{ color: "#94a3b8", marginTop: 4 }}>{worker.position}</div>
                                                <div style={{ color: "#cbd5e1", marginTop: 8 }}>
                                                    Pagesa bazë/ditë: <strong>{eur(worker.baseSalary)}</strong>
                                                </div>
                                                {latest ? (
                                                    <div style={{ color: "#94a3b8", marginTop: 6 }}>
                                                        Rroga e fundit: {monthLabel(latest.month)}
                                                    </div>
                                                ) : (
                                                    <div style={{ color: "#94a3b8", marginTop: 6 }}>
                                                        Ende nuk ka rroga të regjistruara
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                            <button className="button" onClick={() => setPayrollWorker(worker)}>
                                                {currentMonthEntry ? "Ndrysho rrogën" : "Paguaj tani"}
                                            </button>
                                            <button
                                                className="button"
                                                onClick={() =>
                                                    exportPayrollPdfForWorker({
                                                        worker,
                                                        payroll: payrollEntries,
                                                        advances,
                                                    })
                                                }
                                                disabled={payrollEntries.length === 0}
                                            >
                                                PDF
                                            </button>
                                            <button className="button" onClick={() => toggleStats(worker.id)}>
                                                {isExpanded ? "Mbyll statistikat" : "Statistikat"}
                                            </button>
                                            <button className="button danger" onClick={() => handleDeleteWorker(worker)}>
                                                Fshij
                                            </button>
                                        </div>
                                    </div>

                                    {isExpanded ? (
                                        <div style={{ marginTop: 18 }} className="mini-grid">
                                            <div className="mini-item">
                                                <span>Bruto</span>
                                                <strong>{eur(grossForWorker(payrollEntries))}</strong>
                                            </div>
                                            <div className="mini-item">
                                                <span>Neto</span>
                                                <strong>{eur(netForWorker(payrollEntries))}</strong>
                                            </div>
                                            <div className="mini-item">
                                                <span>Kosto firmës</span>
                                                <strong>{eur(costForWorker(payrollEntries))}</strong>
                                            </div>
                                            <div className="mini-item">
                                                <span>Avansat</span>
                                                <strong>{eur(sumAdvances(advances))}</strong>
                                            </div>
                                            <div className="mini-item">
                                                <span>Ditë të punuara</span>
                                                <strong>{workedDaysForWorker(payrollEntries)}</strong>
                                            </div>
                                            <div className="mini-item">
                                                <span>Rreshta rroge</span>
                                                <strong>{payrollEntries.length}</strong>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showAddWorker ? (
                <Modal onClose={() => setShowAddWorker(false)} title="Shto punëtor">
                    <form className="stack-md" onSubmit={submitAddWorker}>
                        <input
                            className="input"
                            placeholder="Emri"
                            value={newWorkerName}
                            onChange={(e) => setNewWorkerName(e.target.value)}
                        />
                        <input
                            className="input"
                            placeholder="Pozita"
                            value={newWorkerPosition}
                            onChange={(e) => setNewWorkerPosition(e.target.value)}
                        />
                        <input
                            className="input"
                            type="number"
                            placeholder="Pagesa për ditë (€)"
                            value={newWorkerDailyRate}
                            onChange={(e) => setNewWorkerDailyRate(e.target.value)}
                        />
                        <div className="row-between" style={{ gap: 10, flexWrap: "wrap" }}>
                            <button type="button" className="button" onClick={() => setShowAddWorker(false)}>
                                Anulo
                            </button>
                            <button type="submit" className="button primary" disabled={addWorkerMutation.isPending}>
                                Ruaj
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {payrollWorker ? (
                <PayrollEditorModal
                    worker={payrollWorker}
                    onClose={() => setPayrollWorker(null)}
                    onSaved={async () => {
                        setPayrollWorker(null);
                        await qc.invalidateQueries({ queryKey: ["workers", "payroll-map"] });
                        await qc.invalidateQueries({ queryKey: ["workers", "advance-map"] });
                    }}
                />
            ) : null}
        </>
    );
}

function Modal({
    title,
    children,
    onClose,
}: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}) {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(2,6,23,.72)",
                display: "grid",
                placeItems: "center",
                padding: 20,
                zIndex: 1000,
            }}
            onClick={onClose}
        >
            <div
                className="card"
                style={{
                    width: "100%",
                    maxWidth: 900,
                    maxHeight: "90vh",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="row-between"
                    style={{
                        marginBottom: 16,
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        background: "rgba(15, 23, 42, 0.96)",
                        paddingBottom: 12,
                    }}
                >
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <button className="button" onClick={onClose}>
                        Mbyll
                    </button>
                </div>

                <div style={{ overflowY: "auto", paddingRight: 4 }}>{children}</div>
            </div>
        </div>
    );
}

function PayrollEditorModal({
    worker,
    onClose,
    onSaved,
}: {
    worker: Worker;
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const currentYm = ymNow();
    const [year, setYear] = useState(yearFromYm(currentYm));
    const [month, setMonth] = useState(monthFromYm(currentYm));
    const [dailyRate, setDailyRate] = useState(String(worker.baseSalary || 35));
    const [employeePct, setEmployeePct] = useState("5");
    const [employerPct, setEmployerPct] = useState("10");
    const [note, setNote] = useState("");
    const [workedDays, setWorkedDays] = useState<Date[]>([]);
    const [selectedAdvanceDay, setSelectedAdvanceDay] = useState<Date | null>(null);

    const ym = ymFromYearMonth(year, month);
    const qc = useQueryClient();

    const { data: monthPayroll } = useQuery({
        queryKey: ["worker", worker.id, "payroll-month", ym],
        queryFn: async () => {
            const rows = await getPayrollEntriesForWorker(worker.id);
            return rows.find((x) => x.month === ym) ?? null;
        },
    });

    const { data: monthAdvances = [] } = useQuery({
        queryKey: ["worker", worker.id, "advances-month", ym],
        queryFn: () => getAdvancesForWorkerMonth(worker.id, ym),
    });

    useEffect(() => {
        if (!monthPayroll) {
            setWorkedDays([]);
            setDailyRate(String(worker.baseSalary || 35));
            setEmployeePct("5");
            setEmployerPct("10");
            setNote("");
            return;
        }

        setWorkedDays(decodeWorkedDays(monthPayroll.workedDaysJson));
        setDailyRate(String(monthPayroll.dailyRate ?? worker.baseSalary ?? 35));
        setEmployeePct(String(monthPayroll.employeePct ?? 5));
        setEmployerPct(String(monthPayroll.employerPct ?? 10));
        setNote(monthPayroll.note ?? "");
    }, [monthPayroll, worker.baseSalary]);

    const saveMutation = useMutation<void, Error, SavePayrollPayload>({
        mutationFn: savePayrollEntryForWorkerMonth,
        onSuccess: onSaved,
    });

    const workedCount = workedDays.length;
    const dr = Number(dailyRate || 0);
    const emp = Number(employeePct || 0);
    const emr = Number(employerPct || 0);
    const gross = dr * workedCount;
    const net = gross * (1 - emp / 100);
    const cost = gross * (1 + emr / 100);
    const monthAdvanceTotal = sumAdvances(monthAdvances);
    const remaining = Math.max(0, gross - monthAdvanceTotal);

    function toggleDay(day: Date) {
        if (isSunday(day)) return;
        setWorkedDays((prev) => {
            const exists = prev.some((x) => sameDate(x, day));
            if (exists) return prev.filter((x) => !sameDate(x, day));
            return [...prev, dateOnly(day)];
        });
    }

    function savePayroll() {
        saveMutation.mutate({
            workerId: worker.id,
            month: ym,
            grossSalary: gross,
            employeePct: emp,
            employerPct: emr,
            dailyRate: dr,
            note: note.trim() || null,
            workedDaysJson: encodeWorkedDays(workedDays),
        });
    }

    const daysInMonth = getDaysInMonth(year, month);
    const firstDayWeekIndex = new Date(year, month - 1, 1).getDay();
    const leadingEmpty = firstDayWeekIndex === 0 ? 6 : firstDayWeekIndex - 1;

    return (
        <>
            <Modal title={`Rroga mujore - ${worker.fullName}`} onClose={onClose}>
                <div className="stack-lg">
                    <div className="row-between" style={{ gap: 12, flexWrap: "wrap" }}>
                        <select
                            className="input"
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            style={{ maxWidth: 220 }}
                        >
                            {MONTH_NAMES.map((m, i) => (
                                <option key={m} value={i + 1}>
                                    {m}
                                </option>
                            ))}
                        </select>

                        <input
                            className="input"
                            type="number"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            style={{ maxWidth: 160 }}
                        />
                    </div>

                    <div className="form-grid">
                        <input
                            className="input"
                            type="number"
                            placeholder="Pagesa për ditë (€)"
                            value={dailyRate}
                            onChange={(e) => setDailyRate(e.target.value)}
                        />
                        <input
                            className="input"
                            type="number"
                            placeholder="Kontribut punëtori (%)"
                            value={employeePct}
                            onChange={(e) => setEmployeePct(e.target.value)}
                        />
                        <input
                            className="input"
                            type="number"
                            placeholder="Kontribut firma (%)"
                            value={employerPct}
                            onChange={(e) => setEmployerPct(e.target.value)}
                        />
                        <input
                            className="input"
                            placeholder="Shënim"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>

                    <div className="card" style={{ padding: 16 }}>
                        <h3 style={{ marginTop: 0 }}>Kalendar i punës - {monthLabel(ym)}</h3>
                        <p style={{ color: "#94a3b8" }}>
                            Kliko ditët që ka punu punëtori. Double click hap avansin për atë ditë.
                        </p>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                                gap: 8,
                                marginTop: 14,
                            }}
                        >
                            {["HËN", "MAR", "MËR", "ENJ", "PRE", "SHT", "DIE"].map((x) => (
                                <div
                                    key={x}
                                    style={{
                                        textAlign: "center",
                                        padding: "10px 8px",
                                        borderRadius: 12,
                                        background: "rgba(255,255,255,.04)",
                                        color: "#94a3b8",
                                        fontWeight: 700,
                                        fontSize: 12,
                                    }}
                                >
                                    {x}
                                </div>
                            ))}

                            {Array.from({ length: leadingEmpty }).map((_, i) => (
                                <div key={`e-${i}`} />
                            ))}

                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = new Date(year, month - 1, i + 1);
                                const selected = workedDays.some((d) => sameDate(d, day));
                                const dayAdvances = monthAdvances.filter((a) =>
                                    sameDate(new Date(a.createdAt), day)
                                );
                                const advanceTotal = sumAdvances(dayAdvances);
                                const sunday = isSunday(day);

                                return (
                                    <button
                                        key={i + 1}
                                        type="button"
                                        onClick={() => toggleDay(day)}
                                        onDoubleClick={() => setSelectedAdvanceDay(day)}
                                        style={{
                                            minHeight: 72,
                                            borderRadius: 14,
                                            border: `1px solid ${sunday
                                                ? "rgba(239,68,68,.3)"
                                                : advanceTotal > 0
                                                    ? "rgba(251,191,36,.5)"
                                                    : selected
                                                        ? "rgba(34,197,94,.45)"
                                                        : "rgba(255,255,255,.08)"
                                                }`,
                                            background: sunday
                                                ? "rgba(239,68,68,.08)"
                                                : advanceTotal > 0 && !selected
                                                    ? "rgba(239,68,68,.10)"
                                                    : advanceTotal > 0 && selected
                                                        ? "rgba(251,191,36,.12)"
                                                        : selected
                                                            ? "rgba(34,197,94,.14)"
                                                            : "rgba(255,255,255,.03)",
                                            color: "#fff",
                                            cursor: sunday ? "not-allowed" : "pointer",
                                        }}
                                        disabled={sunday}
                                        title="Double click për avans"
                                    >
                                        <div style={{ fontWeight: 800 }}>{i + 1}</div>
                                        <div style={{ fontSize: 11, marginTop: 4, color: "#cbd5e1" }}>
                                            {advanceTotal > 0 ? eur(advanceTotal) : selected ? "Punë" : "—"}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mini-grid">
                        <div className="mini-item">
                            <span>Ditë të punuara</span>
                            <strong>{workedCount}</strong>
                        </div>
                        <div className="mini-item">
                            <span>Bruto</span>
                            <strong>{eur(gross)}</strong>
                        </div>
                        <div className="mini-item">
                            <span>Neto</span>
                            <strong>{eur(net)}</strong>
                        </div>
                        <div className="mini-item">
                            <span>Kosto firmës</span>
                            <strong>{eur(cost)}</strong>
                        </div>
                        <div className="mini-item">
                            <span>Avansat e muajit</span>
                            <strong>{eur(monthAdvanceTotal)}</strong>
                        </div>
                        <div className="mini-item">
                            <span>I mbesin me marrë</span>
                            <strong>{eur(remaining)}</strong>
                        </div>
                    </div>

                    <div
                        style={{
                            position: "sticky",
                            bottom: 0,
                            zIndex: 3,
                            background: "rgba(15, 23, 42, 0.96)",
                            paddingTop: 12,
                            paddingBottom: 4,
                        }}
                    >
                        <div className="row-between" style={{ gap: 10, flexWrap: "wrap" }}>
                            <button className="button" onClick={onClose}>
                                Anulo
                            </button>
                            <button
                                className="button primary"
                                onClick={savePayroll}
                                disabled={saveMutation.isPending}
                            >
                                {monthPayroll ? "Ruaj ndryshimet" : "Ruaj rrogën"}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            {selectedAdvanceDay ? (
                <AdvanceDayModal
                    worker={worker}
                    ym={ym}
                    day={selectedAdvanceDay}
                    onClose={() => setSelectedAdvanceDay(null)}
                />
            ) : null}
        </>
    );
}

function AdvanceDayModal({
    worker,
    ym,
    day,
    onClose,
}: {
    worker: Worker;
    ym: string;
    day: Date;
    onClose: () => void;
}) {
    const qc = useQueryClient();
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");

    const { data: monthAdvances = [] } = useQuery({
        queryKey: ["worker", worker.id, "advances-month", ym],
        queryFn: () => getAdvancesForWorkerMonth(worker.id, ym),
    });

    const dayItems = useMemo(
        () => monthAdvances.filter((a) => sameDate(new Date(a.createdAt), day)),
        [monthAdvances, day]
    );

    const addAdvanceMutation = useMutation<void, Error, AddAdvancePayload>({
        mutationFn: addAdvance,
        onSuccess: async () => {
            setAmount("");
            setNote("");
            await qc.invalidateQueries({ queryKey: ["worker", worker.id, "advances-month", ym] });
            await qc.invalidateQueries({ queryKey: ["workers", "advance-map"] });
        },
    });

    const deleteAdvanceMutation = useMutation<void, Error, string>({
        mutationFn: deleteAdvance,
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["worker", worker.id, "advances-month", ym] });
            await qc.invalidateQueries({ queryKey: ["workers", "advance-map"] });
        },
    });

    function submitAdvance(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const value = Number(amount || 0);
        if (value <= 0) return;

        addAdvanceMutation.mutate({
            workerId: worker.id,
            month: ym,
            amount: value,
            note: note.trim() || null,
            createdAt: day.toISOString(),
        });
    }

    const dayLabel = `${String(day.getDate()).padStart(2, "0")}.${String(
        day.getMonth() + 1
    ).padStart(2, "0")}.${day.getFullYear()}`;

    return (
        <Modal title={`Avansë për ${dayLabel}`} onClose={onClose}>
            <div className="stack-lg">
                <div className="card" style={{ padding: 14 }}>
                    <strong>Gjithsej për këtë ditë: {eur(sumAdvances(dayItems))}</strong>
                </div>

                <div className="stack-md">
                    {dayItems.length === 0 ? (
                        <div className="card" style={{ padding: 14 }}>
                            Nuk ka avansë për këtë ditë.
                        </div>
                    ) : (
                        dayItems.map((item) => (
                            <div key={item.id} className="card" style={{ padding: 14 }}>
                                <div className="row-between">
                                    <div>
                                        <div style={{ fontWeight: 800 }}>{eur(item.amount)}</div>
                                        <div style={{ color: "#94a3b8", marginTop: 4 }}>
                                            {item.note || "Pa shënim"}
                                        </div>
                                    </div>
                                    <button
                                        className="button danger"
                                        onClick={() => deleteAdvanceMutation.mutate(item.id)}
                                    >
                                        Fshij
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <form className="stack-md" onSubmit={submitAdvance}>
                    <input
                        className="input"
                        type="number"
                        placeholder="Shuma e avansës (€)"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                    <input
                        className="input"
                        placeholder="Shënim"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="row-between" style={{ gap: 10, flexWrap: "wrap" }}>
                        <button type="button" className="button" onClick={onClose}>
                            Mbyll
                        </button>
                        <button className="button primary" type="submit">
                            Shto avans
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}