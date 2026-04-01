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

    function handleDeleteWorker(worker: Worker) {
        const payrollRows = payrollData[worker.id] ?? [];
        const message = payrollRows.length
            ? `Punëtori "${worker.fullName}" ka ${payrollRows.length} rroga të regjistruara. Nëse vazhdon, do të fshihen edhe rrogat e tij. A don me vazhdu?`
            : `A je i sigurt që don me fshi punëtorin "${worker.fullName}"?`;

        if (!window.confirm(message)) return;
        deleteWorkerMutation.mutate(worker.id);
    }

    async function handleExportAllPreview() {
        await exportPayrollPdfAll({
            workers,
            payrollByWorker: payrollData,
            advancesByWorker: advancesData,
        });
    }

    async function handleExportAllSave() {
        await exportPayrollPdfAll({
            workers,
            payrollByWorker: payrollData,
            advancesByWorker: advancesData,
            save: true,
        } as any);
    }

    if (workersLoading) {
        return (
            <>
                <WorkersPremiumStyles />
                <div className="wp-page">
                    <div className="wp-card">
                        <p>Duke i ngarkuar punëtorët...</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <WorkersPremiumStyles />

            <div className="wp-page">
                <div className="wp-hero">
                    <div>
                        <div className="wp-kicker">MENAXHIMI I PUNËTORËVE</div>
                        <h2 className="wp-title">Evidenca e Punëtorëve</h2>
                        <p className="wp-subtitle">
                            Rroga mujore, avansa, ditë pune dhe raportet PDF.
                        </p>
                    </div>

                    <div className="wp-actions">
                        <button
                            className="wp-btn wp-btn-secondary"
                            onClick={handleExportAllPreview}
                            disabled={workers.length === 0}
                        >
                            Preview PDF (krejt)
                        </button>

                        <button
                            className="wp-btn wp-btn-secondary"
                            onClick={handleExportAllSave}
                            disabled={workers.length === 0}
                        >
                            Save PDF (krejt)
                        </button>

                        <button
                            className="wp-btn wp-btn-primary"
                            onClick={() => setShowAddWorker(true)}
                        >
                            Shto punëtor
                        </button>
                    </div>
                </div>

                <div className="wp-stats-grid">
                    <div className="wp-stat-card">
                        <span className="wp-stat-label">Totali bruto</span>
                        <div className="wp-stat-value">{eur(totalGrossAll)}</div>
                    </div>
                    <div className="wp-stat-card">
                        <span className="wp-stat-label">Totali neto</span>
                        <div className="wp-stat-value">{eur(totalNetAll)}</div>
                    </div>
                    <div className="wp-stat-card">
                        <span className="wp-stat-label">Kosto firmës</span>
                        <div className="wp-stat-value">{eur(totalCostAll)}</div>
                    </div>
                    <div className="wp-stat-card">
                        <span className="wp-stat-label">Avansat</span>
                        <div className="wp-stat-value">{eur(totalAdvancesAll)}</div>
                    </div>
                </div>

                <div className="wp-card wp-worked-summary">
                    <div className="wp-row-between">
                        <strong>Ditë të punuara</strong>
                        <strong>{totalWorkedDaysAll}</strong>
                    </div>
                </div>

                {workers.length === 0 ? (
                    <div className="wp-card">
                        <p>Nuk ka punëtorë të regjistruar.</p>
                    </div>
                ) : (
                    <div className="wp-worker-list">
                        {workers.map((worker) => {
                            const payrollEntries = payrollData[worker.id] ?? [];
                            const advances = advancesData[worker.id] ?? [];
                            const latest = latestPayroll(payrollEntries);
                            const currentMonthEntry = entryForMonth(payrollEntries, ymNow());
                            const isExpanded = expandedIds.includes(worker.id);

                            return (
                                <div className="wp-card wp-worker-card" key={worker.id}>
                                    <div className="wp-worker-head">
                                        <div className="wp-worker-left">
                                            <div className="wp-avatar">
                                                {worker.fullName?.[0]?.toUpperCase() ?? "?"}
                                            </div>

                                            <div className="wp-worker-info">
                                                <div className="wp-worker-name">{worker.fullName}</div>
                                                <div className="wp-worker-role">{worker.position}</div>
                                                <div className="wp-worker-rate">
                                                    Pagesa bazë/ditë: <strong>{eur(worker.baseSalary)}</strong>
                                                </div>
                                                {latest ? (
                                                    <div className="wp-worker-last">
                                                        Rroga e fundit: {monthLabel(latest.month)}
                                                    </div>
                                                ) : (
                                                    <div className="wp-worker-last">
                                                        Ende nuk ka rroga të regjistruara
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="wp-btn-group">
                                            <button
                                                className="wp-btn wp-btn-secondary"
                                                onClick={() => setPayrollWorker(worker)}
                                            >
                                                {currentMonthEntry ? "Ndrysho rrogën" : "Paguaj tani"}
                                            </button>

                                            <button
                                                className="wp-btn wp-btn-secondary"
                                                onClick={async () =>
                                                    await exportPayrollPdfForWorker({
                                                        worker,
                                                        payroll: payrollEntries,
                                                        advances,
                                                    })
                                                }
                                                disabled={payrollEntries.length === 0}
                                            >
                                                Preview PDF
                                            </button>

                                            <button
                                                className="wp-btn wp-btn-secondary"
                                                onClick={async () =>
                                                    await exportPayrollPdfForWorker({
                                                        worker,
                                                        payroll: payrollEntries,
                                                        advances,
                                                        save: true,
                                                    } as any)
                                                }
                                                disabled={payrollEntries.length === 0}
                                            >
                                                Save PDF
                                            </button>

                                            <button
                                                className="wp-btn wp-btn-secondary"
                                                onClick={() => toggleStats(worker.id)}
                                            >
                                                {isExpanded ? "Mbyll statistikat" : "Statistikat"}
                                            </button>

                                            <button
                                                className="wp-btn wp-btn-danger"
                                                onClick={() => handleDeleteWorker(worker)}
                                            >
                                                Fshij
                                            </button>
                                        </div>
                                    </div>

                                    {isExpanded ? (
                                        <div className="wp-mini-grid">
                                            <div className="wp-mini-item">
                                                <span>Bruto</span>
                                                <strong>{eur(grossForWorker(payrollEntries))}</strong>
                                            </div>
                                            <div className="wp-mini-item">
                                                <span>Neto</span>
                                                <strong>{eur(netForWorker(payrollEntries))}</strong>
                                            </div>
                                            <div className="wp-mini-item">
                                                <span>Kosto firmës</span>
                                                <strong>{eur(costForWorker(payrollEntries))}</strong>
                                            </div>
                                            <div className="wp-mini-item">
                                                <span>Avansat</span>
                                                <strong>{eur(sumAdvances(advances))}</strong>
                                            </div>
                                            <div className="wp-mini-item">
                                                <span>Ditë të punuara</span>
                                                <strong>{workedDaysForWorker(payrollEntries)}</strong>
                                            </div>
                                            <div className="wp-mini-item">
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
                    <form className="wp-form-stack" onSubmit={submitAddWorker}>
                        <input
                            className="wp-input"
                            placeholder="Emri"
                            value={newWorkerName}
                            onChange={(e) => setNewWorkerName(e.target.value)}
                        />
                        <input
                            className="wp-input"
                            placeholder="Pozita"
                            value={newWorkerPosition}
                            onChange={(e) => setNewWorkerPosition(e.target.value)}
                        />
                        <input
                            className="wp-input"
                            type="number"
                            placeholder="Pagesa për ditë (€)"
                            value={newWorkerDailyRate}
                            onChange={(e) => setNewWorkerDailyRate(e.target.value)}
                        />
                        <div className="wp-modal-actions">
                            <button
                                type="button"
                                className="wp-btn wp-btn-secondary"
                                onClick={() => setShowAddWorker(false)}
                            >
                                Anulo
                            </button>
                            <button
                                type="submit"
                                className="wp-btn wp-btn-primary"
                                disabled={addWorkerMutation.isPending}
                            >
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
        <div className="wp-modal-overlay" onClick={onClose}>
            <div className="wp-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="wp-modal-header">
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <button className="wp-btn wp-btn-secondary" onClick={onClose}>
                        Mbyll
                    </button>
                </div>

                <div className="wp-modal-body">{children}</div>
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

    const workedAmount = dr * workedCount;
    const monthAdvanceTotal = sumAdvances(monthAdvances);
    const remainingSalary = Math.max(0, workedAmount - monthAdvanceTotal);

    const gross = workedAmount;
    const net = gross * (1 - emp / 100);
    const cost = gross * (1 + emr / 100);

    function toggleDay(day: Date) {
        if (isSunday(day)) return;
        setWorkedDays((prev) => {
            const exists = prev.some((x) => sameDate(x, day));
            if (exists) return prev.filter((x) => !sameDate(x, day));
            return [...prev, dateOnly(day)];
        });
    }

    function openAdvanceModal(day: Date) {
        setSelectedAdvanceDay(day);
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
                <div className="wp-form-stack">
                    <div className="wp-select-row">
                        <select
                            className="wp-input"
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                        >
                            {MONTH_NAMES.map((m, i) => (
                                <option key={m} value={i + 1}>
                                    {m}
                                </option>
                            ))}
                        </select>

                        <input
                            className="wp-input"
                            type="number"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                        />
                    </div>

                    <div className="wp-form-grid">
                        <input
                            className="wp-input"
                            type="number"
                            placeholder="Pagesa për ditë (€)"
                            value={dailyRate}
                            onChange={(e) => setDailyRate(e.target.value)}
                        />
                        <input
                            className="wp-input"
                            type="number"
                            placeholder="Kontribut punëtori (%)"
                            value={employeePct}
                            onChange={(e) => setEmployeePct(e.target.value)}
                        />
                        <input
                            className="wp-input"
                            type="number"
                            placeholder="Kontribut firma (%)"
                            value={employerPct}
                            onChange={(e) => setEmployerPct(e.target.value)}
                        />
                        <input
                            className="wp-input"
                            placeholder="Shënim"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>

                    <div className="wp-card wp-calendar-wrap">
                        <h3 className="wp-section-title">Kalendar i punës - {monthLabel(ym)}</h3>
                        <p className="wp-hint">
                            Kliko ditët që ka punu punëtori. Kliko ikonën në qoshe për avans.
                        </p>

                        <div className="wp-calendar-grid">
                            {["HËN", "MAR", "MËR", "ENJ", "PRE", "SHT", "DIE"].map((x) => (
                                <div key={x} className="wp-calendar-head">
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

                                let className = "wp-day-btn";
                                if (sunday) className += " is-sunday";
                                else if (advanceTotal > 0 && selected) className += " has-advance-selected";
                                else if (advanceTotal > 0) className += " has-advance";
                                else if (selected) className += " is-selected";

                                return (
                                    <button
                                        key={i + 1}
                                        type="button"
                                        onClick={() => toggleDay(day)}
                                        className={className}
                                        disabled={sunday}
                                        title={advanceTotal > 0 ? "Ka avans" : "Ditë pune"}
                                    >
                                        <div className="wp-day-number">{i + 1}</div>

                                        <button
                                            type="button"
                                            className={`wp-advance-icon ${advanceTotal > 0 ? "is-active" : ""}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openAdvanceModal(day);
                                            }}
                                            title="Hap avansin"
                                            aria-label={`Hap avansin për ditën ${i + 1}`}
                                        >
                                            €
                                        </button>

                                        <div className="wp-day-sub">
                                            {advanceTotal > 0 ? eur(advanceTotal) : selected ? "Punë" : "—"}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="wp-payroll-summary-card">
                        <div className="wp-payroll-summary-row">
                            <span>Sa ka punu</span>
                            <strong>{eur(workedAmount)}</strong>
                        </div>
                        <div className="wp-payroll-summary-row">
                            <span>Avansi</span>
                            <strong>{eur(monthAdvanceTotal)}</strong>
                        </div>
                        <div className="wp-payroll-summary-row is-final">
                            <span>I mbesin pa marrë</span>
                            <strong>{eur(remainingSalary)}</strong>
                        </div>
                    </div>

                    <div className="wp-mini-grid">
                        <div className="wp-mini-item">
                            <span>Ditë të punuara</span>
                            <strong>{workedCount}</strong>
                        </div>
                        <div className="wp-mini-item">
                            <span>Sa ka punu</span>
                            <strong>{eur(workedAmount)}</strong>
                        </div>
                        <div className="wp-mini-item">
                            <span>Avansat e muajit</span>
                            <strong>{eur(monthAdvanceTotal)}</strong>
                        </div>
                        <div className="wp-mini-item wp-mini-item-highlight">
                            <span>I mbesin pa marrë</span>
                            <strong>{eur(remainingSalary)}</strong>
                        </div>
                        <div className="wp-mini-item">
                            <span>Neto</span>
                            <strong>{eur(net)}</strong>
                        </div>
                        <div className="wp-mini-item">
                            <span>Kosto firmës</span>
                            <strong>{eur(cost)}</strong>
                        </div>
                    </div>

                    <div className="wp-sticky-footer">
                        <div className="wp-modal-actions">
                            <button className="wp-btn wp-btn-secondary" onClick={onClose}>
                                Anulo
                            </button>
                            <button
                                className="wp-btn wp-btn-primary"
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
            <div className="wp-form-stack">
                <div className="wp-card">
                    <strong>Gjithsej për këtë ditë: {eur(sumAdvances(dayItems))}</strong>
                </div>

                <div className="wp-form-stack">
                    {dayItems.length === 0 ? (
                        <div className="wp-card">Nuk ka avansë për këtë ditë.</div>
                    ) : (
                        dayItems.map((item) => (
                            <div key={item.id} className="wp-card">
                                <div className="wp-row-between">
                                    <div>
                                        <div className="wp-advance-amount">{eur(item.amount)}</div>
                                        <div className="wp-advance-note">{item.note || "Pa shënim"}</div>
                                    </div>
                                    <button
                                        className="wp-btn wp-btn-danger"
                                        onClick={() => deleteAdvanceMutation.mutate(item.id)}
                                    >
                                        Fshij
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <form className="wp-form-stack" onSubmit={submitAdvance}>
                    <input
                        className="wp-input"
                        type="number"
                        placeholder="Shuma e avansës (€)"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                    <input
                        className="wp-input"
                        placeholder="Shënim"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="wp-modal-actions">
                        <button type="button" className="wp-btn wp-btn-secondary" onClick={onClose}>
                            Mbyll
                        </button>
                        <button className="wp-btn wp-btn-primary" type="submit">
                            Shto avans
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}

function WorkersPremiumStyles() {
    return (
        <style>{`
      .wp-page{
        display:flex;
        flex-direction:column;
        gap:18px;
        padding:18px;
      }

      .wp-hero{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
        padding:20px;
        border-radius:26px;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,.18), transparent 28%),
          radial-gradient(circle at top left, rgba(59,130,246,.15), transparent 35%),
          linear-gradient(145deg, rgba(15,23,42,.96), rgba(30,41,59,.92));
        border:1px solid rgba(255,255,255,.08);
        box-shadow:0 16px 40px rgba(0,0,0,.30);
      }

      .wp-kicker{
        color:#86efac;
        font-size:12px;
        font-weight:800;
        letter-spacing:.16em;
        margin-bottom:8px;
      }

      .wp-title{
        margin:0;
        color:#f8fafc;
        font-size:32px;
        line-height:1.1;
        font-weight:900;
      }

      .wp-subtitle{
        margin:10px 0 0;
        color:#94a3b8;
        max-width:700px;
        line-height:1.6;
      }

      .wp-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      .wp-card,
      .wp-stat-card,
      .wp-mini-item,
      .wp-payroll-summary-card{
        border-radius:22px;
        background:linear-gradient(145deg, rgba(30,41,59,.90), rgba(15,23,42,.92));
        border:1px solid rgba(255,255,255,.07);
        box-shadow:0 12px 28px rgba(0,0,0,.22);
        backdrop-filter:blur(8px);
      }

      .wp-card{
        padding:16px;
      }

      .wp-stats-grid{
        display:grid;
        grid-template-columns:repeat(4, minmax(0, 1fr));
        gap:14px;
      }

      .wp-stat-card{
        padding:18px;
      }

      .wp-stat-label{
        display:block;
        color:#94a3b8;
        font-size:13px;
        margin-bottom:10px;
      }

      .wp-stat-value{
        font-size:24px;
        font-weight:900;
        color:#f8fafc;
        letter-spacing:-0.02em;
      }

      .wp-worked-summary{
        padding:16px 18px;
      }

      .wp-row-between{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
      }

      .wp-worker-list{
        display:flex;
        flex-direction:column;
        gap:14px;
      }

      .wp-worker-card{
        padding:18px;
      }

      .wp-worker-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
        flex-wrap:wrap;
      }

      .wp-worker-left{
        display:flex;
        gap:14px;
        min-width:0;
        flex:1;
      }

      .wp-avatar{
        width:58px;
        height:58px;
        border-radius:18px;
        display:grid;
        place-items:center;
        font-weight:900;
        font-size:20px;
        color:#f8fafc;
        background:linear-gradient(135deg, rgba(59,130,246,.9), rgba(34,197,94,.75));
        box-shadow:0 10px 24px rgba(59,130,246,.25);
        flex-shrink:0;
      }

      .wp-worker-info{
        min-width:0;
        display:flex;
        flex-direction:column;
        gap:4px;
      }

      .wp-worker-name{
        color:#f8fafc;
        font-size:20px;
        font-weight:900;
        line-height:1.2;
      }

      .wp-worker-role{
        color:#cbd5e1;
        font-size:14px;
        font-weight:700;
      }

      .wp-worker-rate,
      .wp-worker-last{
        color:#94a3b8;
        font-size:13px;
      }

      .wp-btn-group{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      .wp-btn{
        border:0;
        outline:0;
        border-radius:14px;
        padding:11px 16px;
        font-weight:800;
        cursor:pointer;
        transition:transform .18s ease, box-shadow .18s ease, opacity .18s ease;
      }

      .wp-btn:hover{
        transform:translateY(-1px);
      }

      .wp-btn:disabled{
        opacity:.55;
        cursor:not-allowed;
        transform:none;
      }

      .wp-btn-primary{
        color:#04130a;
        background:linear-gradient(135deg, #86efac, #22c55e);
        box-shadow:0 12px 26px rgba(34,197,94,.28);
      }

      .wp-btn-secondary{
        color:#e2e8f0;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.08);
      }

      .wp-btn-danger{
        color:#fff;
        background:linear-gradient(135deg, #ef4444, #dc2626);
        box-shadow:0 12px 26px rgba(239,68,68,.24);
      }

      .wp-mini-grid,
      .wp-form-grid,
      .wp-select-row{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
      }

      .wp-mini-grid{
        grid-template-columns:repeat(3,minmax(0,1fr));
        margin-top:14px;
      }

      .wp-mini-item{
        padding:14px;
      }

      .wp-mini-item span{
        display:block;
        color:#94a3b8;
        font-size:12px;
        margin-bottom:8px;
      }

      .wp-mini-item strong{
        color:#f8fafc;
        font-size:18px;
        font-weight:900;
      }

      .wp-mini-item-highlight{
        border:1px solid rgba(34,197,94,.30);
        background:linear-gradient(145deg, rgba(21,128,61,.24), rgba(15,23,42,.94));
        box-shadow:0 12px 30px rgba(34,197,94,.18);
      }

      .wp-mini-item-highlight span,
      .wp-mini-item-highlight strong{
        color:#dcfce7;
      }

      .wp-form-stack{
        display:flex;
        flex-direction:column;
        gap:12px;
      }

      .wp-input{
        width:100%;
        min-height:48px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.04);
        color:#f8fafc;
        padding:12px 14px;
        outline:none;
      }

      .wp-input::placeholder{
        color:#94a3b8;
      }

      .wp-input:focus{
        border-color:rgba(59,130,246,.5);
        box-shadow:0 0 0 3px rgba(59,130,246,.18);
      }

      .wp-modal-overlay{
        position:fixed;
        inset:0;
        background:rgba(2,6,23,.72);
        backdrop-filter:blur(8px);
        display:grid;
        place-items:center;
        padding:18px;
        z-index:1000;
      }

      .wp-modal-card{
        width:min(980px,100%);
        max-height:90vh;
        overflow:auto;
        border-radius:24px;
        background:linear-gradient(145deg, rgba(30,41,59,.98), rgba(15,23,42,.98));
        border:1px solid rgba(255,255,255,.08);
        box-shadow:0 18px 40px rgba(0,0,0,.35);
      }

      .wp-modal-header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:18px;
        border-bottom:1px solid rgba(255,255,255,.08);
      }

      .wp-modal-body{
        padding:18px;
      }

      .wp-modal-actions{
        display:flex;
        gap:10px;
        justify-content:flex-end;
        flex-wrap:wrap;
      }

     .wp-calendar-wrap{
  padding:16px;
  overflow-x:auto;
  -webkit-overflow-scrolling:touch;
}

.wp-calendar-wrap::-webkit-scrollbar{
  height:8px;
}

.wp-calendar-wrap::-webkit-scrollbar-thumb{
  background:rgba(148,163,184,.35);
  border-radius:999px;
}

      .wp-section-title{
        margin:0 0 8px;
        color:#f8fafc;
      }

      .wp-hint{
        margin:0 0 14px;
        color:#94a3b8;
        font-size:13px;
      }

      .wp-calendar-grid{
  display:grid;
  grid-template-columns:repeat(7, minmax(78px, 1fr));
  gap:8px;
  min-width:100%;
}

      .wp-calendar-head{
        color:#94a3b8;
        font-size:12px;
        text-align:center;
        padding:6px 0;
        font-weight:700;
      }

      .wp-day-btn{
  position:relative;
  min-height:78px;
  min-width:78px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.04);
  color:#e2e8f0;
  cursor:pointer;
  padding:10px 8px;
}

      .wp-day-btn.is-selected{
        background:rgba(34,197,94,.18);
        border-color:rgba(34,197,94,.38);
      }

      .wp-day-btn.has-advance{
        background:rgba(59,130,246,.16);
        border-color:rgba(59,130,246,.34);
      }

      .wp-day-btn.has-advance-selected{
        background:linear-gradient(135deg, rgba(34,197,94,.22), rgba(59,130,246,.20));
        border-color:rgba(255,255,255,.18);
      }

      .wp-day-btn.is-sunday{
        opacity:.45;
        cursor:not-allowed;
      }

      .wp-day-number{
        font-weight:900;
        font-size:16px;
      }

      .wp-day-sub{
        margin-top:6px;
        font-size:12px;
        color:#cbd5e1;
      }

      .wp-advance-icon{
        position:absolute;
        top:6px;
        right:6px;
        width:20px;
        height:20px;
        border-radius:999px;
        display:grid;
        place-items:center;
        font-size:11px;
        font-weight:900;
        border:1px solid rgba(255,255,255,.14);
        color:#cbd5e1;
        background:rgba(15,23,42,.75);
        cursor:pointer;
        padding:0;
        transition:transform .18s ease, box-shadow .18s ease, background .18s ease;
      }

      .wp-advance-icon:hover{
        transform:scale(1.06);
      }

      .wp-advance-icon.is-active{
        color:#0f172a;
        background:linear-gradient(135deg, #facc15, #f59e0b);
        border-color:rgba(245,158,11,.55);
        box-shadow:0 6px 14px rgba(245,158,11,.35);
      }

      .wp-payroll-summary-card{
        padding:16px;
        border:1px solid rgba(34,197,94,.22);
        background:
          radial-gradient(circle at top right, rgba(34,197,94,.14), transparent 28%),
          linear-gradient(145deg, rgba(21,128,61,.18), rgba(15,23,42,.95));
      }

      .wp-payroll-summary-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:12px 0;
        border-bottom:1px solid rgba(255,255,255,.08);
      }

      .wp-payroll-summary-row:last-child{
        border-bottom:none;
      }

      .wp-payroll-summary-row span{
        color:#cbd5e1;
        font-weight:700;
      }

      .wp-payroll-summary-row strong{
        color:#f8fafc;
        font-size:20px;
        font-weight:900;
      }

      .wp-payroll-summary-row.is-final span{
        color:#86efac;
      }

      .wp-payroll-summary-row.is-final strong{
        color:#dcfce7;
        font-size:24px;
      }

      .wp-sticky-footer{
        position:sticky;
        bottom:0;
        padding-top:8px;
        background:linear-gradient(to top, rgba(15,23,42,1), rgba(15,23,42,.75), transparent);
      }

      .wp-advance-amount{
        color:#f8fafc;
        font-size:18px;
        font-weight:900;
      }

      .wp-advance-note{
        color:#94a3b8;
        margin-top:4px;
      }

      @media (max-width: 980px){
        .wp-stats-grid,
        .wp-mini-grid,
        .wp-form-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media (max-width: 720px){
  .wp-page{
    padding:14px;
  }

  .wp-hero{
    padding:16px;
    border-radius:22px;
  }

  .wp-title{
    font-size:26px;
  }

  .wp-stats-grid,
  .wp-mini-grid,
  .wp-form-grid,
  .wp-select-row{
    grid-template-columns:1fr;
  }

  .wp-worker-head{
    flex-direction:column;
  }

  .wp-btn-group,
  .wp-actions,
  .wp-modal-actions{
    width:100%;
    justify-content:stretch;
  }

  .wp-btn{
    width:100%;
  }

  .wp-calendar-wrap{
    padding:12px;
    margin-inline:-4px;
  }

  .wp-calendar-grid{
    grid-template-columns:repeat(7, 72px);
    gap:6px;
    min-width:max-content;
    width:max-content;
  }

  .wp-calendar-head{
    width:72px;
    min-width:72px;
    font-size:11px;
    padding:4px 0 6px;
  }

  .wp-day-btn{
    width:72px;
    min-width:72px;
    min-height:68px;
    padding:8px 6px;
    border-radius:12px;
  }

  .wp-day-number{
    font-size:15px;
  }

  .wp-day-sub{
    margin-top:5px;
    font-size:11px;
    line-height:1.2;
  }

  .wp-advance-icon{
    top:4px;
    right:4px;
    width:18px;
    height:18px;
    font-size:10px;
  }

  .wp-payroll-summary-row strong{
    font-size:18px;
  }

  .wp-payroll-summary-row.is-final strong{
    font-size:21px;
  }
}
    `}</style>
    );
}