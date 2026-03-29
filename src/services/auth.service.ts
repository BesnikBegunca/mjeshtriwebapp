import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";

export async function registerOwner(
    email: string,
    password: string,
    companyName: string
) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    await setDoc(doc(db, "owners", uid), {
        role: "owner",
        email,
        companyName,
        createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "owners", uid, "company", "profile"), {
        name: companyName,
        address: "",
        phone: "",
        email,
        nipt: "",
        logoUrl: "",
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, "owners", uid, "parameters", "main"), {
        litersPer100: 8,
        wastePct: 10,
        coats: 2,
        bucketPrice: 45,
        laborCategory: "Punë dore",
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return cred.user;
}

export async function loginOwner(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function logoutOwner() {
    await signOut(auth);
}