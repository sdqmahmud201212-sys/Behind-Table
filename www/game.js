
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    get,
    onValue
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyBFFVigbO3r5vZbl7vfgzVboChHjXn2h-A",
    authDomain: "behind-table.firebaseapp.com",
    databaseURL: "https://behind-table-default-rtdb.firebaseio.com",
    projectId: "behind-table",
    storageBucket: "behind-table.firebasestorage.app",
    messagingSenderId: "637325725035",
    appId: "1:637325725035:web:696bb4b800ed5ba713d02e",
    measurementId: "G-EJN8J5HFGD"
};

// INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// DATABASE REFERENCES
const connectionRef = ref(database, "connection_test");

// ANONYMOUS LOGIN
signInAnonymously(auth)
    .then((result) => {
        console.log("Firebase giriş uğurludur!");
        console.log("User ID:", result.user.uid);

        return set(connectionRef, {
            status: "connected",
            userId: result.user.uid,
            timestamp: Date.now()
        });
    })
    .then(() => {
        console.log("Realtime Database bağlantısı uğurludur!");
    })
    .catch((error) => {
        console.error("Firebase xətası:", error.code, error.message);
    });

// AUTH STATE
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Oyunçu tanındı:", user.uid);
    }
});
