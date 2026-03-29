import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getParameters,
  saveParameters,
} from "../services/parameters.service";

export function ParametersPage() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["parameters"],
    queryFn: getParameters,
  });

  const [litersPer100, setLitersPer100] = useState("8");
  const [wastePct, setWastePct] = useState("10");
  const [coats, setCoats] = useState("2");
  const [bucketPrice, setBucketPrice] = useState("45");
  const [laborCategory, setLaborCategory] = useState("Punë dore");

  useEffect(() => {
    if (!data) return;
    setLitersPer100(String(data.litersPer100 ?? 8));
    setWastePct(String(data.wastePct ?? 10));
    setCoats(String(data.coats ?? 2));
    setBucketPrice(String(data.bucketPrice ?? 45));
    setLaborCategory(data.laborCategory ?? "Punë dore");
  }, [data]);

  const mutation = useMutation({
    mutationFn: saveParameters,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["parameters"] });
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    mutation.mutate({
      litersPer100: Number(litersPer100 || 0),
      wastePct: Number(wastePct || 0),
      coats: Number(coats || 0),
      bucketPrice: Number(bucketPrice || 0),
      laborCategory: laborCategory.trim(),
    });
  }

  if (isLoading) {
    return (
      <div className="card">
        <p>Duke i ngarkuar parametrat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p>Ndodhi një gabim gjatë ngarkimit të parametrave.</p>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <div className="card">
        <div className="row-between">
          <div>
            <h3>Parametrat e ngjyrosjes</h3>
            <p>Këto vlera përdoren automatikisht në Kalkulo.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <input
            className="input"
            type="number"
            placeholder="Litra / 100m²"
            value={litersPer100}
            onChange={(e) => setLitersPer100(e.target.value)}
          />

          <input
            className="input"
            type="number"
            placeholder="Humbja %"
            value={wastePct}
            onChange={(e) => setWastePct(e.target.value)}
          />

          <input
            className="input"
            type="number"
            placeholder="Shtresat"
            value={coats}
            onChange={(e) => setCoats(e.target.value)}
          />

          <input
            className="input"
            type="number"
            placeholder="Çmimi i kovës"
            value={bucketPrice}
            onChange={(e) => setBucketPrice(e.target.value)}
          />

          <input
            className="input"
            placeholder="Kategoria e punës"
            value={laborCategory}
            onChange={(e) => setLaborCategory(e.target.value)}
          />

          <button
            className="button primary"
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Duke ruajtur..." : "Ruaj parametrat"}
          </button>
        </form>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <span className="stat-title">Litra / 100m²</span>
          <div className="stat-value">{litersPer100 || "0"}</div>
        </div>
        <div className="card stat-card">
          <span className="stat-title">Humbja %</span>
          <div className="stat-value">{wastePct || "0"}</div>
        </div>
        <div className="card stat-card">
          <span className="stat-title">Shtresat</span>
          <div className="stat-value">{coats || "0"}</div>
        </div>
        <div className="card stat-card">
          <span className="stat-title">Çmimi i kovës</span>
          <div className="stat-value">{bucketPrice || "0"}</div>
        </div>
      </div>
    </div>
  );
}