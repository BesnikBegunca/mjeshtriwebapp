import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFirma, saveFirma } from "../services/firma.service";

export function FirmaPage() {
    const qc = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ["firma"],
        queryFn: getFirma,
    });

    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [nipt, setNipt] = useState("");

    useEffect(() => {
        if (!data) return;
        setName(data.name ?? "");
        setAddress(data.address ?? "");
        setPhone(data.phone ?? "");
        setEmail(data.email ?? "");
        setNipt(data.nipt ?? "");
    }, [data]);

    const mutation = useMutation({
        mutationFn: saveFirma,
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["firma"] });
        },
    });

    function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!name.trim()) return;

        mutation.mutate({
            name: name.trim(),
            address: address.trim(),
            phone: phone.trim(),
            email: email.trim(),
            nipt: nipt.trim(),
            logoUrl: data?.logoUrl ?? "",
        });
    }

    if (isLoading) {
        return (
            <div className="card">
                <p>Duke e ngarkuar profilin e firmës...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card">
                <p>Ndodhi një gabim gjatë ngarkimit të firmës.</p>
            </div>
        );
    }

    return (
        <div className="stack-lg">
            <div className="card">
                <div className="row-between">
                    <div>
                        <h3>Profili i firmës</h3>
                        <p>Të dhënat e kompanisë ruhen veç për owner-in e kyçur.</p>
                    </div>
                </div>

                <form className="form-grid" onSubmit={onSubmit}>
                    <input
                        className="input"
                        placeholder="Emri i firmës"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />

                    <input
                        className="input"
                        placeholder="Adresa"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                    />

                    <input
                        className="input"
                        placeholder="Telefoni"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />

                    <input
                        className="input"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <input
                        className="input"
                        placeholder="NIPT / NRB"
                        value={nipt}
                        onChange={(e) => setNipt(e.target.value)}
                    />

                    <button
                        className="button primary"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? "Duke ruajtur..." : "Ruaj profilin"}
                    </button>
                </form>
            </div>

            <div className="card">
                <h3>Preview</h3>
                <div className="mini-grid">
                    <div className="mini-item">
                        <span>Emri</span>
                        <strong>{name || "-"}</strong>
                    </div>
                    <div className="mini-item">
                        <span>Telefoni</span>
                        <strong>{phone || "-"}</strong>
                    </div>
                    <div className="mini-item">
                        <span>Email</span>
                        <strong>{email || "-"}</strong>
                    </div>
                </div>
            </div>
        </div>
    );
}