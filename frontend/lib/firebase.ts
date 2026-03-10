import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: "AIzaSyCg3VcGvBfJ-jJQyJnm9s4w0IFI2n4gJnA",
    authDomain: "hxstockanalysis.firebaseapp.com",
    projectId: "hxstockanalysis",
    storageBucket: "hxstockanalysis.firebasestorage.app",
    messagingSenderId: "190067472409",
    appId: "1:190067472409:web:81149922feb011c4e15288",
    measurementId: "G-M9XTZJTBED"
}

// Initialize Firebase only once (avoid re-initialization on hot reloads)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app)

export { db }
