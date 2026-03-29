import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createWorker,
    getWorkers,
    removeWorker,
} from "../services/workers.service";
import { eur } from "../lib/money";

export function WorkersPage() {
    const qc = useQueryClient();

    const [fullName, setFullName] = useState("");
    const [position, setPosition] = useState("");
    const [baseSalary, setBaseSalary] = useState("");

    const { data = [], isLoading } = useQuery({
        queryKey: ["workers"],
        queryFn: getWorkers,
    });

    const createMutation = useMutation({
        mutationFn: createWorker,
        onSuccess: async () => {
            setFullName("");
            setPosition("");
            setBaseSalary("");
            await qc.invalidateQueries({ queryKey: ["workers"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: removeWorker,
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["workers"] });
        },
    });

    const totalBaseSalary = useMemo(() => {
        return data.reduce((sum, item) => sum + (item.baseSalary || 0), 0);
    }, [data]);

    function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!fullName.trim()) return;

        createMutation.mutate({
            fullName: fullName.trim(),
            position: position.trim(),
            baseSalary: Number(baseSalary || 0),
            ownerId: "",
        });
    }

    return (
        <div className="stack-lg">
            <div className="card">
                <h3>Shto punëtor</h3>

                <form className="form-grid" onSubmit={onSubmit}>
                    <input
                        className="input"
                        placeholder="Emri i plotë"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                    />

                    <input
                        className="input"
                        placeholder="Pozita"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                    />

                    <input
                        className="input"
                        placeholder="Paga bazë"
                        type="number"
                        value={baseSalary}
                        onChange={(e) => setBaseSalary(e.target.value)}
                    />

                    <button
                        className="button primary"
                        type="submit"
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? "Duke ruajtur..." : "Ruaj"}
                    </button>
                </form>
            </div>

            <div className="stats-grid">
                <div className="card stat-card">
                    <span className="stat-title">Totali i punëtorëve</span>
                    <div className="stat-value">{data.length}</div>
                </div>

                <div className="card stat-card">
                    <span className="stat-title">Paga bazë totale</span>
                    <div className="stat-value">{eur(totalBaseSalary)}</div>
                </div>
            </div>

            <div className="card">
                <h3>Lista e punëtorëve</h3>

                {isLoading ? (
                    <p>Duke i ngarkuar...</p>
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Emri</th>
                                    <th>Pozita</th>
                                    <th>Paga bazë</th>
                                    <th></th>
                                </tr>
                            </thead>

                            <tbody>
                                {data.map((worker) => (
                                    <tr key={worker.id}>
                                        <td>{worker.fullName}</td>
                                        <td>{worker.position}</td>
                                        <td>{eur(worker.baseSalary)}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="button danger"
                                                onClick={() => deleteMutation.mutate(worker.id)}
                                            >
                                                Fshij
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {data.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>Nuk ka punëtorë ende.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}