import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/config";

export type AppUserRole = "superadmin" | "owner";

export type AppUserProfile = {
  uid: string;
  fullName: string;
  email: string;
  role: AppUserRole;
  companyId: string | null;
  companyName?: string;
  isActive: boolean;
  isDeleted?: boolean;
};

type AuthContextType = {
  firebaseUser: User | null;
  profile: AppUserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setLoading(true);
      setFirebaseUser(user);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", user.uid);

      unsubscribeProfile = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as AppUserProfile);
          } else {
            console.error("Nuk u gjet dokumenti users/" + user.uid);
            setProfile(null);
          }
          setLoading(false);
        },
        (error) => {
          console.error("Gabim gjate leximit te profilit:", error);
          setProfile(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      logout: async () => {
        await signOut(auth);
      },
    }),
    [firebaseUser, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth duhet me u perdor brenda AuthProvider");
  }
  return ctx;
}