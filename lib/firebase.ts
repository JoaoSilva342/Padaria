import { initializeApp, getApps } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyAXFx7JhZxPdRgZUG0A_iv1EEVvc--NzeQ",
  authDomain: "barbearia-43367.firebaseapp.com",
  databaseURL: "https://barbearia-43367-default-rtdb.firebaseio.com",
  projectId: "barbearia-43367",
  storageBucket: "barbearia-43367.firebasestorage.app",
  messagingSenderId: "377789557247",
  appId: "1:377789557247:web:e7264fddfb3365ac021fca",
  measurementId: "G-ZDXZHXT6V9",
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const auth = getAuth(app)
const db = getFirestore(app)

export { app, auth, db }
