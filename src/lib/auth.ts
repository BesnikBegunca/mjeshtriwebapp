import { auth } from "../firebase/config";

export function getOwnerId(): string {
    const uid = auth.currentUser?.uid;

    if (!uid) {
        throw new Error("User nuk është i kyçur.");
    }

    return uid;
}