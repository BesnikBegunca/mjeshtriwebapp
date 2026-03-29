export function eur(value: number) {
    return new Intl.NumberFormat("sq-XK", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
}