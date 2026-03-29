import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createQmimorjaItem,
  getQmimorjaItems,
  removeQmimorjaItem,
  type CreateQmimorjaPayload,
} from "../services/qmimorja.service";
import { eur } from "../lib/money";

export function QmimorjaPage() {
  const qc = useQueryClient();

  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [search, setSearch] = useState("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["qmimorja"],
    queryFn: getQmimorjaItems,
  });

  const createMutation = useMutation<void, Error, CreateQmimorjaPayload>({
    mutationFn: createQmimorjaItem,
    onSuccess: async () => {
      setCategory("");
      setName("");
      setUnit("");
      setPrice("");
      await qc.invalidateQueries({ queryKey: ["qmimorja"] });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: removeQmimorjaItem,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["qmimorja"] });
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;

    return data.filter((item) =>
      [item.category, item.name, item.unit].some((v) =>
        String(v ?? "").toLowerCase().includes(s)
      )
    );
  }, [data, search]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim()) return;

    createMutation.mutate({
      category: category.trim(),
      name: name.trim(),
      unit: unit.trim(),
      price: Number(price || 0),
    });
  }

  if (error) {
    return (
      <div className="card">
        <p>Ndodhi një gabim gjatë ngarkimit të qmimores.</p>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <div className="card">
        <div className="row-between">
          <div>
            <h3>Shto artikull në qmimore</h3>
            <p>Çdo owner e ka qmimoren e vet në Firebase.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <input
            className="input"
            placeholder="Kategoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <input
            className="input"
            placeholder="Emri"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="input"
            placeholder="Njësia"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />

          <input
            className="input"
            placeholder="Çmimi"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
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

      <div className="card">
        <div className="row-between">
          <h3>Qmimorja</h3>

          <input
            className="input search-input"
            placeholder="Kërko..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p>Duke i ngarkuar artikujt...</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kategoria</th>
                  <th>Emri</th>
                  <th>Njësia</th>
                  <th>Çmimi</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{item.category}</td>
                    <td>{item.name}</td>
                    <td>{item.unit}</td>
                    <td>{eur(item.price)}</td>
                    <td>
                      <button
                        type="button"
                        className="button danger"
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Fshij
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Nuk ka artikuj ende.</td>
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