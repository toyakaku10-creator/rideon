import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCUbqLumOWYOUEFK_tXfyFkVg6vNEOKvZs",
  authDomain: "rideon-aad80.firebaseapp.com",
  projectId: "rideon-aad80",
  storageBucket: "rideon-aad80.firebasestorage.app",
  messagingSenderId: "910621245630",
  appId: "1:910621245630:web:ae56f119c50d3b09cfdeef",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
