export interface Worker {
    id: string;
    fullName: string;
    position: string;
    baseSalary: number;
    ownerId?: string;
    createdAt?: unknown;
    updatedAt?: unknown;
}