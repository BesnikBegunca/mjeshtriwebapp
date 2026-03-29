import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase config (qajo qe e solle ti)
const firebaseConfig = {
  apiKey: "AIzaSyDRS5r3zUXBsmv_1zcdj4-DDQWOnnrxoW8",
  authDomain: "mjeshtriwebapp.firebaseapp.com",
  projectId: "mjeshtriwebapp",
  storageBucket: "mjeshtriwebapp.firebasestorage.app",
  messagingSenderId: "521628287854",
  appId: "1:521628287854:web:d33d6697ba3a572c10777f",
  measurementId: "G-RRE51KY038",
};

// Init Firebase
const app = initializeApp(firebaseConfig);

// KTO JAN TE RENDESISHME
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;