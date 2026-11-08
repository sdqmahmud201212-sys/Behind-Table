
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  runTransaction,
  remove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

/* FIREBASE */
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app, "https://behind-table-default-rtdb.firebaseio.com");

/* PERSONAJLAR */
const CHARACTERS = [
  "Moto moto",
  "Polat Amımdar",
  "Lez Ziya",
  "Məməşbaş",
  "Əmdüley",
  "Maygülü",
  "Siksoran",
  "Tötəş",
  "Əmir",
  "Çuban Ələddin"
];

/* DƏYİŞƏNLƏR */
let uid = null;
let currentRoom = null;
let roomData = null;
let roomUnsub = null;
let busy = false;
let lastEffectId = null;

const $ = id => document.getElementById(id);

/* EKRANLAR */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  $(id)?.classList.add("active");
}

function message(text) {
  $("homeError").textContent = text;
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");

  setTimeout(() => el.classList.remove("show"), 2500);
}

function setConnection(text) {
  $("connection").textContent = text;
}

/* AUTH */
const authReady = new Promise((resolve, reject) => {
  signInAnonymously(auth).catch(reject);

  onAuthStateChanged(auth, user => {
    if (user) {
      uid = user.uid;
      setConnection("BAĞLANTI QURULDU");
      resolve(user);
    }
  });
});

authReady.catch(error => {
  console.error("Firebase Auth:", error);
  setConnection("BAĞLANTI XƏTASI");
  message("Firebase bağlantısı qurulmadı: " + error.message);
});

/* KOD YARATMA */
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

/* OTAĞA QULAQ ASMA */
function subscribeRoom(code) {
  if (roomUnsub) roomUnsub();

  currentRoom = code;
  lastEffectId = null;

  const roomRef = ref(db, "rooms/" + code);

  roomUnsub = onValue(roomRef, snapshot => {
    if (!snapshot.exists()) {
      toast("Otaq artıq mövcud deyil.");
      currentRoom = null;
      showScreen("home");
      return;
    }

    roomData = snapshot.val();

    if (lastEffectId === null) {
      lastEffectId = roomData.lastShot?.id || "";
    } else if (
      roomData.lastShot?.id &&
      roomData.lastShot.id !== lastEffectId
    ) {
      lastEffectId = roomData.lastShot.id;
    }

    renderRoom();
  }, error => {
    console.error(error);
    toast("Otaq məlumatı yüklənmədi.");
  });
}

/* OTAQ YARAT */
async function createRoom() {
  if (busy) return;
  busy = true;
  message("");

  try {
    await authReady;

    const nickname = $("nickname").value.trim();

    if (!nickname) {
      message("Əvvəlcə oyunçu adını yaz.");
      return;
    }

    setConnection("OTAQ YARADILIR...");

    let code;
    let roomRef;
    let exists = true;

    for (let i = 0; i < 10; i++) {
      code = generateCode();
      roomRef = ref(db, "rooms/" + code);

      const snapshot = await get(roomRef);

      if (!snapshot.exists()) {
        exists = false;
        break;
      }
    }

    if (exists) throw new Error("Otaq kodu yaradıla bilmədi.");

    const room = {
      code,
      host: uid,
      status: "lobby",
      round: 1,
      currentTurn: uid,
      players: {
        [uid]: {
          name: nickname,
          character: CHARACTERS[0],
          alive: true,
          joinedAt: Date.now()
        }
      },
      events: {
        0: nickname + " otağı yaratdı."
      }
    };

    await set(roomRef, room);

    subscribeRoom(code);
    showScreen("lobby");
    toast("Otaq yaradıldı!");

  } catch (error) {
    console.error("Otaq yaratma xətası:", error);
    message("Xəta: " + error.message);
    setConnection("BAĞLANTI XƏTASI");
  } finally {
    busy = false;
  }
}

/* OTAĞA QOŞUL */
async function joinRoom() {
  if (busy) return;
  busy = true;
  message("");

  try {
    await authReady;

    const nickname = $("nickname").value.trim();
    const code = $("roomCodeInput").value.trim().toUpperCase();

    if (!nickname) {
      message("Oyunçu adını daxil et.");
      return;
    }

    if (code.length !== 4) {
      message("Otaq kodu 4 simvol olmalıdır.");
      return;
    }

    const roomRef = ref(db, "rooms/" + code);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      message("Belə otaq tapılmadı.");
      return;
    }

    const room = snapshot.val();

    if (room.status !== "lobby") {
      message("Bu otaqda oyun artıq başlayıb.");
      return;
    }

    const players = room.players || {};

    if (Object.keys(players).length >= 10) {
      message("Otaq doludur.");
      return;
    }

    await update(roomRef, {
      ["players/" + uid]: {
        name: nickname,
        character: CHARACTERS[0],
        alive: true,
        joinedAt: Date.now()
      }
    });

    subscribeRoom(code);
    showScreen("lobby");
    toast("Otağa qoşuldun!");

  } catch (error) {
    console.error("Qoşulma xətası:", error);
    message("Xəta: " + error.message);
  } finally {
    busy = false;
  }
}

/* LOBBİ */
function renderRoom() {
  if (!roomData) return;

  const players = Object.entries(roomData.players || {});
  const isHost = roomData.host === uid;

  $("roomCodeDisplay").textContent = currentRoom;
  $("gameRoomCode").textContent = currentRoom;
  $("playerCount").textContent = players.length + "/10";

  $("playerList").innerHTML = players.map(([id, player]) => `
    <div class="player-row">
      <span>${escapeHTML(player.name)}</span>
      <span>${id === roomData.host ? "HOST" : "OYUNÇU"}</span>
    </div>
  `).join("");

  $("characterSelect").innerHTML = CHARACTERS.map(character =>
    `<option value="${escapeHTML(character)}">${escapeHTML(character)}</option>`
  ).join("");

  const me = roomData.players?.[uid];

  if (me) $("characterSelect").value = me.character;

  $("startGame").style.display = isHost ? "block" : "none";
  $("lobbyHint").textContent = isHost
    ? "Dostların qoşulduqdan sonra oyunu başlada bilərsən."
    : "Otaq sahibinin oyunu başlatmasını gözlə.";

  if (roomData.status === "game") {
    showScreen("game");
    renderGame();
  } else if (roomData.status === "ended") {
    showScreen("ended");
    renderEnd();
  } else {
    showScreen("lobby");
  }
}

/* HTML TƏHLÜKƏSİZLİYİ */
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/* PERSONAJ SEÇİMİ */
async function changeCharacter() {
  if (!currentRoom || !uid) return;

  const character = $("characterSelect").value;

  try {
    await update(
      ref(db, `rooms/${currentRoom}/players/${uid}`),
      { character }
    );
  } catch (error) {
    console.error(error);
    toast("Personaj dəyişdirilə bilmədi.");
  }
}

/* OYUNU BAŞLAT */
async function startGame() {
  if (!roomData || roomData.host !== uid) return;

  const players = Object.keys(roomData.players || {});

  if (players.length < 2) {
    toast("Başlamaq üçün ən azı 2 oyunçu lazımdır.");
    return;
  }

  try {
    await update(ref(db, "rooms/" + currentRoom), {
      status: "game",
      currentTurn: players[0],
      round: 1,
      events: {
        0: "Oyun başladı."
      }
    });
  } catch (error) {
    console.error(error);
    toast("Oyun başlatmaq mümkün olmadı.");
  }
}

/* NÖVBƏ */
function alivePlayers() {
  return Object.entries(roomData?.players || {})
    .filter(([, player]) => player.alive);
}

function nextAliveId(players, currentId) {
  const index = players.findIndex(([id]) => id === currentId);
  return players[(index + 1) % players.length]?.[0];
}

/* OYUN MASASI */
function renderGame() {
  if (!roomData) return;

  const players = Object.entries(roomData.players || {});
  const alive = alivePlayers();
  const isMyTurn = roomData.currentTurn === uid;

  $("aliveCount").textContent = alive.length + " OYUNÇU";
  $("roundLabel").textContent = roomData.round || 1;

  const currentPlayer = roomData.players?.[roomData.currentTurn];

  $("turnLabel").textContent = isMyTurn
    ? "SƏNİN NÖVBƏNDİR"
    : currentPlayer
      ? currentPlayer.name + " OYNAYIR"
      : "NÖVBƏ GÖZLƏNİLİR";

  const size = 33;
  const center = 50;

  $("seatList").innerHTML = players.map(([id, player], index) => {
    const angle = (index / players.length) * Math.PI * 2 - Math.PI / 2;
    const x = center + Math.cos(angle) * size;
    const y = center + Math.sin(angle) * size;

    return `
      <div class="seat ${!player.alive ? "dead" : ""} ${id === roomData.currentTurn ? "current" : ""}"
           style="left:${x}%;top:${y}%">
        <div class="avatar">${player.alive ? "●" : "✕"}</div>
        <span class="seat-name">${escapeHTML(player.name)}</span>
        <span class="seat-char">${escapeHTML(player.character || "")}</span>
      </div>
    `;
  }).join("") + `
    <div class="table-gun">
      <svg viewBox="0 0 200 100">
        <path class="gun-barrel" d="M95 35 L190 35 L190 55 L95 55 Z"/>
        <path class="gun-frame" d="M45 30 L105 30 L120 60 L100 72 L50 65 Z"/>
        <circle class="gun-cylinder" cx="85" cy="48" r="22"/>
        <circle class="gun-cylinder-hole" cx="85" cy="48" r="9"/>
        <path class="gun-handle" d="M48 57 L80 65 L65 95 L40 85 Z"/>
        <path class="gun-trigger" d="M110 60 Q125 75 112 80"/>
        <circle class="gun-screw" cx="52" cy="42" r="3"/>
      </svg>
    </div>
    <div class="shot-effect" id="shotEffect">
      <div class="shot-burst"></div>
      <div class="shot-word">BANG!</div>
      <div class="shot-caption">MASA ARXASINDA</div>
    </div>
  `;

  $("targetArea").innerHTML = alive.map(([id, player]) => `
    <button class="target-btn ${selectedTarget === id ? "selected" : ""}"
            data-target="${id}">
      ${escapeHTML(player.name)}${id === uid ? " (SƏN)" : ""}
    </button>
  `).join("");

  document.querySelectorAll("[data-target]").forEach(button => {
    button.addEventListener("click", () => {
      selectedTarget = button.dataset.target;
      renderGame();
    });
  });

  $("shootButton").disabled = !isMyTurn || !selectedTarget;
  $("shootButton").textContent = isMyTurn
    ? "HƏDƏFİ TƏSDİQLƏ VƏ ATƏŞ AÇ"
    : "NÖVBƏNİ GÖZLƏ";

  $("actionTitle").textContent = isMyTurn
    ? "HƏDƏFİNİ SEÇ"
    : "NÖVBƏ GÖZLƏNİLİR";

  $("actionDescription").textContent = isMyTurn
    ? "Masanın arxasında qərar sənindir."
    : "Digər oyunçunun hərəkətini gözlə.";

  $("eventLog").innerHTML = Object.values(roomData.events || {})
    .slice(-8)
    .reverse()
    .map(event => `<div class="log-entry">${escapeHTML(event)}</div>`)
    .join("");

  if (roomData.lastShot?.id && roomData.lastShot.id !== lastEffectId) {
    lastEffectId = roomData.lastShot.id;
    const effect = $("shotEffect");
    if (effect) {
      effect.classList.add("play");
    }
  }
}

let selectedTarget = null;

/* ATƏŞ */
async function shoot() {
  if (busy || !currentRoom || !selectedTarget) return;

  busy = true;

  try {
    const roomRef = ref(db, "rooms/" + currentRoom);

    await runTransaction(roomRef, room => {
      if (!room || room.status !== "game") return;

      if (room.currentTurn !== uid) return;

      const players = room.players || {};
      const shooter = players[uid];
      const target = players[selectedTarget];

      if (!shooter?.alive || !target?.alive) return;

      const hit = Math.random() < 0.5;

      if (hit) {
        target.alive = false;
      }

      const alive = Object.entries(players)
        .filter(([, player]) => player.alive);

      const events = room.events || {};
      events[Date.now()] = hit
        ? shooter.name + " atəş açdı. " + target.name + " oyundan çıxdı."
        : shooter.name + " atəş açdı. Güllə boş çıxdı!";

      const shotId = Date.now() + "-" + Math.random();

      room.lastShot = {
        id: shotId,
        hit,
        shooter: uid,
        target: selectedTarget
      };

      room.events = events;

      if (alive.length <= 1) {
        room.status = "ended";
        room.winner = alive[0]?.[0] || null;
      } else if (hit || selectedTarget !== uid) {
        room.currentTurn = nextAliveId(alive, uid);
      }

      return room;
    });

    selectedTarget = null;

  } catch (error) {
    console.error(error);
    toast("Atəş açmaq mümkün olmadı.");
  } finally {
    busy = false;
  }
}

/* OYUN SONU */
function renderEnd() {
  const winner = roomData.players?.[roomData.winner];

  $("winnerTitle").textContent = winner?.name || "HEÇ KİM";
  $("winnerText").textContent = winner
    ? winner.character + " masanın sonuncu sahibi oldu."
    : "Oyun başa çatdı.";
}

/* OTAQDAN ÇIX */
async function leaveRoom() {
  if (!currentRoom || !uid) {
    showScreen("home");
    return;
  }

  try {
    const roomRef = ref(db, "rooms/" + currentRoom);
    const snapshot = await get(roomRef);

    if (snapshot.exists()) {
      const room = snapshot.val();

      if (room.host === uid) {
        await remove(roomRef);
      } else {
        await remove(ref(db, `rooms/${currentRoom}/players/${uid}`));
      }
    }
  } catch (error) {
    console.error(error);
  }

  if (roomUnsub) roomUnsub();

  roomUnsub = null;
  currentRoom = null;
  roomData = null;
  selectedTarget = null;

  showScreen("home");
}

/* KODU KOPYALA */
async function copyRoomCode() {
  if (!currentRoom) return;

  try {
    await navigator.clipboard.writeText(currentRoom);
    toast("Otaq kodu kopyalandı!");
  } catch {
    toast("Kod: " + currentRoom);
  }
}

/* DÜYMƏLƏR */
$("createRoom").addEventListener("click", createRoom);
$("joinRoom").addEventListener("click", joinRoom);
$("startGame").addEventListener("click", startGame);
$("characterSelect").addEventListener("change", changeCharacter);
$("shootButton").addEventListener("click", shoot);
$("leaveLobby").addEventListener("click", leaveRoom);
$("leaveGame").addEventListener("click", leaveRoom);
$("backHome").addEventListener("click", leaveRoom);
$("copyCode").addEventListener("click", copyRoomCode);

/* BAŞLANĞIC */
showScreen("home");
setConnection("BAĞLANTI GÖZLƏNİLİR");
  
