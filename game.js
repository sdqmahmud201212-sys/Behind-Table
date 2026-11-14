/* ==========================================================================
   MASA ARXASINDA — RETRO MULTIPLAYER & BOT ENGINE (FULL MASTER FILE)
   ========================================================================== */


import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";


/* ==========================================================================
   1. FIREBASE KONFİQURASİYASI VƏ SİSTEM DƏYİŞƏNLƏRİ
   ========================================================================== */


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
const db = getDatabase(app);


// Əsas Vəziyyət (State) Dəyişənləri
let uid = null;
let currentRoom = null;
let roomData = null;
let roomUnsub = null;
let authReady = false;
let busy = false;
let selectedCards = [];
let selectedTarget = null;
let lastEventId = null;
let isPracticeMode = false;
let practiceState = null;
let toastTimeout = null;
let selectionInterval = null;
let faceInterval = null;
let botTurnTimeout = null;
let isShootingAnimation = false;


const $ = (id) => document.getElementById(id);


/* ==========================================================================
   2. PERSONAJLAR VƏ KART MƏLUMAT BAZASI
   ========================================================================== */


const CHARACTERS = [
  { id: "moto", name: "Moto moto", face: "😎", desc: "Soyuqqanlı taktiki stil" },
  { id: "polat", name: "Polat Amımdar", face: "🕶️", desc: "Risk almağı sevən retro qəhrəman" },
  { id: "lez", name: "Lez Ziya", face: "🤠", desc: "Qocaman qumarbaz" },
  { id: "memesbas", name: "Məməşbaş", face: "🤓", desc: "Riyazi ehtimalları hesablayan bot" },
  { id: "emdul", name: "Əmdüley", face: "🥸", desc: "Gizli və təhlükəli strategiyaçı" },
  { id: "maygulu", name: "Maygülü", face: "😈", desc: "Xaos yaradan hiyləgər" },
  { id: "emesgeri", name: "Əməsgəri", face: "👽", desc: "Proqnozlaşdırıla bilməyən taktika" },
  { id: "totes", name: "Tötəş", face: "🤡", desc: "Şansına arxalanan oyunçu" },
  { id: "amir", name: "Əmir", face: "🧐", desc: "Detektiv psixologiyası" },
  { id: "chuban", name: "Çuban Ələddin", face: "🤖", desc: "Alqoritmlə işləyən dəmir iradə" }
];


const CARD_DATA = {
  detective: {
    id: "detective",
    name: "Detektiv",
    icon: "🔎",
    description: "Növbəti kamerada güllə olub-olmadığını dərhal öyrən.",
    color: "#48c6ff"
  },
  swap: {
    id: "swap",
    name: "Yerdəyişmə",
    icon: "🔄",
    description: "Sənə atəş açıldıqda zərbəni hücumçuya yönəlt. Hücumçu 1 can itirir.",
    color: "#54e39a"
  },
  counter: {
    id: "counter",
    name: "Əks təsir",
    icon: "🛡️",
    description: "Dolu güllə səni vurarsa, zərəri tam blokla və +1 can qazan (Maks: 3).",
    color: "#8b5cf6"
  },
  witch: {
    id: "witch",
    name: "İfritəlik",
    icon: "🧙",
    description: "Seçilmiş hədəfə növbəti atəşin vurma ehtimalını 80%-ə qaldır.",
    color: "#ff5caa"
  },
selfLove: {
    id: "selfLove",
    name: "Canını sevmək",
    icon: "❤️",
    description: "Özünə atəş açanda vurulma ehtimalını 1/4-ə (25%) endir.",
    color: "#ff5364"
  },
  evil: {
    id: "evil",
    name: "İbnəlik",
    icon: "☠️",
    description: "Dolu güllə hədəfi dərhal öldürür; boş çıxarsa, özün 1 can itirirsən.",
    color: "#ffd447"
  }
};


const ROUND_CONFIG = {
  1: { chambers: 6, bullets: 2, cards: 1, selectionTime: 30, automaticCards: false },
  2: { chambers: 8, bullets: 3, cards: 2, selectionTime: 30, automaticCards: false },
  3: { chambers: 9, bullets: 4, cards: 2, selectionTime: 30, automaticCards: false },
  4: { chambers: 9, bullets: 5, cards: 3, selectionTime: 30, automaticCards: false },
  5: { chambers: 12, bullets: 7, cards: 3, selectionTime: 0, automaticCards: true }
};


/* ==========================================================================
   3. KÖMƏKÇİ UTILITY FUNKSİYALARI
   ========================================================================== */


function randomId(length = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let res = "";
  for (let i = 0; i < length; i++) res += chars[Math.floor(Math.random() * chars.length)];
  return res;
}


function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}


function shuffleArray(array) {
  const res = [...array];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}


function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}


function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}


function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}


function getPlayerName(player) {
  return player?.nickname || player?.name || "Naməlum Oyunçu";
}


function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = $(id);
  if (target) target.classList.add("active");
}


function setBusy(val) {
  busy = val;
  document.querySelectorAll("button").forEach(btn => {
    if (btn.dataset.ignoreBusy === "true") return;
    btn.disabled = val;
  });
}


function showToast(msg) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
}


function showError(msg) {
  const err = $("homeError");
  if (err) err.textContent = msg;
  else showToast(msg);
}


function clearError() {
  const err = $("homeError");
  if (err) err.textContent = "";
}


function getNickname() {
  const name = $("nickname")?.value?.trim() || "";
  if (name.length < 2) throw new Error("Ləqəb ən azı 2 simvoldan ibarət olmalıdır.");
  if (name.length > 18) throw new Error("Ləqəb maksimum 18 simvol ola bilər.");
  return name;
}


function requireAuth() {
  if (!authReady || !uid) throw new Error("Serverə qoşulma gözlənilir. Bir az sonra yenidən yoxlayın.");
}


function getRoomRef() {
  if (!currentRoom) throw new Error("Hazırda aktiv otaqda deyilsiniz.");
  return ref(db, `rooms/${currentRoom}`);
}


function getMyPlayer() {
  if (!roomData || !uid) return null;
  return roomData.players?.[uid] || null;
}


function isHost() {
  return roomData?.host === uid;
}


function getPlayers() {
  if (!roomData?.players) return [];
  return Object.entries(roomData.players).map(([id, player]) => ({ ...player, uid: id }));
}


function getAlivePlayers(playersMap) {
  const list = playersMap ? Object.values(playersMap) : getPlayers();
  return list.filter(p => p.alive !== false);
}


function getShotLimit(playerCount) {
  if (playerCount <= 3) return 2;
  if (playerCount <= 5) return 3;
  if (playerCount <= 7) return 4;
  return 5;
}


/* ==========================================================================
   4. AUTHENTICATION VƏ FIREBASE KÖMƏKÇİLƏRİ
   ========================================================================== */


onAuthStateChanged(auth, async (user) => {
  if (user) {
    uid = user.uid;
    authReady = true;
    setText("connection", "● SERVERƏ BAĞLI");
    if ($("connection")) $("connection").style.color = "#54e39a";
  } else {
    authReady = false;
    setText("connection", "● BAĞLANTI GÖZLƏNİLİR");
    if ($("connection")) $("connection").style.color = "#ffd447";
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("Anonim giriş xətası:", e);
      showToast("Serverə anonim bağlanmaq mümkün olmadı.");
    }
  }
});


const connectionRef = ref(db, ".info/connected");
onValue(connectionRef, snapshot => {
  const connected = snapshot.val() === true;
  const conn = $("connection");
  if (!conn) return;
  if (connected) {
    conn.textContent = "● SERVERƏ BAĞLI";
    conn.style.color = "#54e39a";
  } else {
    conn.textContent = "● BAĞLANTI KƏSİLDİ";
    conn.style.color = "#ff5364";
  }
});


function unsubscribeRoom() {
  if (roomUnsub) {
    roomUnsub();
    roomUnsub = null;
  }
}


function subscribeRoom(roomCode) {
  unsubscribeRoom();
  currentRoom = roomCode;
  const roomReference = ref(db, `rooms/${roomCode}`);
  roomUnsub = onValue(
    roomReference,
    snapshot => {
      if (!snapshot.exists()) {
        roomData = null;
        showToast("Otaq artıq mövcud deyil və ya ləğv edildi.");
        unsubscribeRoom();
        currentRoom = null;
        showScreen("home");
        return;
      }
      roomData = snapshot.val();
      renderRoom();
    },
    error => {
      console.error("Otaq dinləmə xətası:", error);
      showToast("Otaq məlumatı yenilənərkən xəta baş verdi.");
    }
  );
}
function createEvent(message, type = "normal") {
  return { id: randomId(16), message, type, time: Date.now() };
}


async function addRoomEvent(message, type = "normal") {
  if (isPracticeMode && practiceState) {
    practiceState.events = practiceState.events || [];
    practiceState.events.unshift(createEvent(message, type));
    practiceState.events = practiceState.events.slice(0, 40);
    renderPracticeGame();
    return;
  }
  if (!currentRoom) return;
  const event = createEvent(message, type);
  const events = Array.isArray(roomData?.events) ? [...roomData.events] : [];
  events.push(event);
  try {
    await update(getRoomRef(), { events: events.slice(-60) });
  } catch (e) {
    console.error("Event yazma xətası:", e);
  }
}


function renderEventLog(events = []) {
  const log = $("eventLog");
  if (!log) return;
  log.innerHTML = "";
  [...events].reverse().forEach(event => {
    const entry = document.createElement("div");
    entry.className = `event-entry event-${event.type || "normal"}`;
    entry.textContent = event.message || "";
    log.appendChild(entry);
  });
}


function renderLatestEvent(events = []) {
  const latest = $("latestEvent");
  if (!latest || !events.length) return;
  const event = events[events.length - 1];
  if (!event || event.id === lastEventId) return;
  lastEventId = event.id;
  latest.textContent = event.message || "Oyun davam edir...";
  latest.classList.remove("event-update");
  void latest.offsetWidth;
  latest.classList.add("event-update");
}


/* ==========================================================================
   6. LOBBY VƏ OTAQ YARATMA MECHANİCS
   ========================================================================== */


async function createRoom() {
  if (busy) return;
  clearError();
  try {
    requireAuth();
    const name = getNickname();
    setBusy(true);


    let roomCode = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = makeRoomCode();
      const candidateRef = ref(db, `rooms/${candidate}`);
      const snapshot = await get(candidateRef);
      if (!snapshot.exists()) {
        roomCode = candidate;
        break;
      }
    }
    if (!roomCode) throw new Error("Otaq kodu təyin edilə bilmədi. Yenidən cəhd edin.");


    const character = CHARACTERS[0];
    const newRoom = {
      status: "lobby",
      host: uid,
      createdAt: Date.now(),
      round: 1,
      currentTurn: uid,
      players: {
        [uid]: {
          uid,
          name,
          character: character.id,
          face: character.face,
          alive: true,
          hearts: 2,
          ready: false,
          cardReady: false,
          selectedCards: [],
          usedCards: [],
          joinedAt: Date.now(),
          isBot: false
        }
      },
      events: [createEvent(`${name} otağı yaratdı.`, "system")],
      gameState: null
    };


    await set(ref(db, `rooms/${roomCode}`), newRoom);
    subscribeRoom(roomCode);
    showToast(`Otaq yaradıldı: ${roomCode}`);
  } catch (err) {
    showError(err.message || "Otaq yaradıla bilmədi.");
  } finally {
    setBusy(false);
  }
}


async function joinRoom() {
  if (busy) return;
  clearError();
  try {
    requireAuth();
    const name = getNickname();
    const code = $("roomCodeInput")?.value?.trim().toUpperCase();
    if (!code || code.length !== 4) throw new Error("4 simvollu otaq kodunu daxil edin.");
    setBusy(true);


    const roomReference = ref(db, `rooms/${code}`);
    const snapshot = await get(roomReference);
    if (!snapshot.exists()) throw new Error("Belə bir otaq tapılmadı.");


    const data = snapshot.val();
    if (data.status !== "lobby") throw new Error("Bu otaqda oyun artıq başlayıb.");


    if (data.players?.[uid]) {
      subscribeRoom(code);
      return;
    }


    const playerCount = Object.keys(data.players || {}).length;
    if (playerCount >= 10) throw new Error("Otaq doludur. Maksimum 10 oyunçu mümkündür.");


    const character = CHARACTERS.find(c => {
      return !Object.values(data.players || {}).some(p => p.character === c.id);
    }) || randomItem(CHARACTERS);


    const newPlayer = {
      uid,
      name,
      character: character.id,
      face: character.face,
      alive: true,
      hearts: 2,
      ready: false,
      cardReady: false,
      selectedCards: [],
      usedCards: [],
      joinedAt: Date.now(),
      isBot: false
    };


    await update(ref(db, `rooms/${code}/players/${uid}`), newPlayer);
    await update(roomReference, {
      events: [...(data.events || []), createEvent(`${name} otağa qoşuldu.`, "system")].slice(-60)
    });
    subscribeRoom(code);
    showToast("Otağa uğurla qoşuldunuz!");
  } catch (err) {
    showError(err.message || "Otağa qoşulmaq mümkün olmadı.");
  } finally {
    setBusy(false);
  }
}
function renderLobby() {
  showScreen("lobby");
  setText("roomCodeDisplay", currentRoom || "----");
  const players = getPlayers();
  setText("playerCount", `${players.length}/10`);
  renderPlayerList(players);
  renderCharacterSelect();


  const me = getMyPlayer();
  if ($("readyStatus")) {
    $("readyStatus").textContent = me?.ready ? "Hazırsan!" : "Hələ hazır deyilsən.";
  }
  const readyButton = $("readyButton");
  if (readyButton) {
    readyButton.textContent = me?.ready ? "HAZIR DEYİLƏM" : "HAZIRAM";
  }


  const startButton = $("startGame");
  if (startButton) {
    startButton.style.display = isHost() ? "" : "none";
    const allReady = players.length >= 2 && players.every(p => p.ready === true);
    startButton.disabled = !allReady;
    startButton.textContent = allReady ? "OYUNA BAŞLA" : "OYUNÇULAR GÖZLƏNİLİR";
  }
}


function renderPlayerList(players) {
  const list = $("playerList");
  if (!list) return;
  list.innerHTML = "";
  players.forEach(player => {
    const character = getCharacter(player.character);
    const item = document.createElement("div");
    item.className = "player-item";
    if (player.uid === roomData.host) item.classList.add("host");


    const avatar = document.createElement("span");
    avatar.className = "player-avatar";
    avatar.textContent = character.face;


    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.name;


    const status = document.createElement("span");
    status.className = "host-label";
    if (player.uid === roomData.host) {
      status.textContent = "HOST";
    } else {
      status.textContent = player.ready ? "HAZIR" : "GÖZLƏYİR";
      status.style.color = player.ready ? "#54e39a" : "#b7afd7";
    }


    item.append(avatar, name, status);
    list.appendChild(item);
  });
}


function renderCharacterSelect() {
  const select = $("characterSelect");
  if (!select) return;
  const me = getMyPlayer();
  if (!me) return;
  const prevVal = me.character || CHARACTERS[0].id;
  select.innerHTML = "";
  CHARACTERS.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.face} ${c.name}`;
    const taken = getPlayers().some(p => p.uid !== uid && p.character === c.id);
    opt.disabled = taken;
    select.appendChild(opt);
  });
  select.value = prevVal;
}


async function changeCharacter(characterId) {
  if (!currentRoom || !uid) return;
  const c = CHARACTERS.find(item => item.id === characterId);
  if (!c) return;
  const taken = getPlayers().some(p => p.uid !== uid && p.character === characterId);
  if (taken) {
    showToast("Bu personaj artıq başqa oyunçu tərəfindən seçilib.");
    return;
  }
  try {
    await update(ref(db, `rooms/${currentRoom}/players/${uid}`), {
      character: c.id,
      face: c.face,
      ready: false
    });
    showToast(`${c.name} seçildi.`);
  } catch (e) {
    console.error("Personaj dəyişmə xətası:", e);
  }
}


async function toggleReady() {
  if (!currentRoom || !uid || busy) return;
  const me = getMyPlayer();
  if (!me) return;
  try {
    await update(ref(db, `rooms/${currentRoom}/players/${uid}`), { ready: !me.ready });
  } catch (e) {
    showToast("Hazırlıq statusu yenilənmədi.");
  }
}
/* ==========================================================================
   7. KART SEÇİMİ VƏ RAUND DÖVRİYYƏSİ
   ========================================================================== */


async function startGame() {
  if (busy || !currentRoom || !isHost()) return;
  try {
    const players = getPlayers();
    if (players.length < 2) throw new Error("Oyun üçün ən azı 2 oyunçu vacibdir.");
    setBusy(true);


    const initialRound = 1;
    const config = ROUND_CONFIG[initialRound];
    const updates = {
      status: "cardSelection",
      round: initialRound,
      currentTurn: null,
      gameState: {
        round: initialRound,
        chambers: config.chambers,
        bullets: config.bullets,
        shotsTaken: 0,
        shotLimit: null,
        chamberIndex: 0,
        chamberOrder: [],
        selectedTarget: null,
        selectionStartedAt: Date.now(),
        selectionEndsAt: Date.now() + config.selectionTime * 1000,
        cardSelectionsComplete: false
      },
      events: [...(roomData.events || []), createEvent("Oyun başlayır! 1-ci raund üçün kart seçimi.", "system")].slice(-60)
    };


    const playerUpdates = {};
    players.forEach(p => {
      playerUpdates[`players/${p.uid}/cardReady`] = false;
      playerUpdates[`players/${p.uid}/usedCards`] = [];
      playerUpdates[`players/${p.uid}/hearts`] = 2;
    });


    await update(getRoomRef(), { ...updates, ...playerUpdates });
    selectedCards = [];
  } catch (err) {
    showToast(err.message || "Oyunu başlatmaq mümkün olmadı.");
  } finally {
    setBusy(false);
  }
}


function renderCardSelection() {
  showScreen("cardSelection");
  const round = Number(roomData?.round || 1);
  const config = ROUND_CONFIG[round] || ROUND_CONFIG[5];
  const me = getMyPlayer();
  if (!me) return;


  setText("cardRound", `RAUND ${round}`);
  setText(
    "cardSelectionDescription",
    config.automaticCards
      ? "Bu raundda təsadüfi 3 fərqli kart veriləcək."
      : `Bu raund üçün ${config.cards} kart seçməlisiniz.`
  );
  setText("selectedCardCount", `${(me.selectedCards || []).length} / ${config.cards} kart seçilib`);
  setText("cardTimer", config.automaticCards ? "AVTOMATİK" : "MÜDDƏT: 30 SANİYƏ");


  const grid = $("cardGrid");
  if (grid) {
    const cards = grid.querySelectorAll(".game-card");
    const playerCards = me.selectedCards || [];
    cards.forEach(btn => {
      const cardId = btn.dataset.card;
      const card = CARD_DATA[cardId];
      if (!card) return;


      const isSel = playerCards.includes(cardId);
      btn.classList.toggle("selected", isSel);


      const name = btn.querySelector(".card-name");
      if (name) name.textContent = card.name;
      const desc = btn.querySelector(".card-description");
      if (desc) desc.textContent = card.description;


      const used = (me.usedCards || []).includes(cardId);
      btn.disabled = used && !isSel;
    });
  }


  const confirmBtn = $("confirmCards");
  if (confirmBtn) {
    const ready = me.cardReady === true;
    confirmBtn.textContent = ready ? "SEÇİM TƏSDİQLƏNDİ" : "SEÇİMİ TƏSDİQLƏ";
    confirmBtn.disabled = ready || (!config.automaticCards && (me.selectedCards || []).length !== config.cards);
  }
}


async function toggleCard(cardId) {
  if (isPracticeMode) {
    togglePracticeCard(cardId);
    return;
  }
  if (!currentRoom || !uid || busy) return;
  const me = getMyPlayer();
  if (!me || me.cardReady) return;


  const round = Number(roomData?.round || 1);
  const config = ROUND_CONFIG[round] || ROUND_CONFIG[5];


  if (config.automaticCards) {
    showToast("Bu raundda kartlar avtomatik verilir.");
    return;
  }


  let cur = [...(me.selectedCards || [])];
  if (cur.includes(cardId)) {
    cur = cur.filter(c => c !== cardId);
  } else {
    if (cur.length >= config.cards) {
      showToast(`Bu raundda maksimum ${config.cards} kart seçə bilərsiniz.`);
      return;
    }
    if ((me.usedCards || []).includes(cardId)) {
      showToast("Bu kart artıq istifadə olunub.");
      return;
    }
    cur.push(cardId);
  }


  try {
    await update(ref(db, `rooms/${currentRoom}/players/${uid}`), { selectedCards: cur });
  } catch (e) {
    showToast("Kart seçimini yeniləmək mümkün olmadı.");
  }
}


async function confirmCards() {
  if (isPracticeMode) {
    confirmPracticeCards();
    return;
  }
  if (!currentRoom || !uid || busy) return;
  const me = getMyPlayer();
  if (!me || me.cardReady) return;


  const round = Number(roomData?.round || 1);
  const config = ROUND_CONFIG[round] || ROUND_CONFIG[5];


  let cards = [...(me.selectedCards || [])];
  if (config.automaticCards) {
    cards = selectRandomCards(config.cards, me.usedCards || []);
  } else if (cards.length !== config.cards) {
    showToast(`Dəqiq ${config.cards} kart seçməlisiniz.`);
    return;
  }


  try {
    setBusy(true);
    await update(ref(db, `rooms/${currentRoom}/players/${uid}`), {
      selectedCards: cards,
      cardReady: true
    });
    showToast("Kart seçimi təsdiqləndi!");
    if (isHost()) checkAndStartRound();
  } catch (e) {
    showToast("Kart təsdiqləmə xətası.");
  } finally {
    setBusy(false);
  }
}


function selectRandomCards(count, excluded = []) {
  const available = Object.keys(CARD_DATA).filter(id => !excluded.includes(id));
  return shuffleArray(available).slice(0, count);
}


async function checkAndStartRound() {
  if (!isHost() || !roomData) return;
  const players = getAlivePlayers();
  const allReady = players.every(p => p.cardReady === true);
  if (allReady) {
    await startOnlineRound();
  }
}


async function startOnlineRound() {
  const round = Number(roomData.round || 1);
  const config = ROUND_CONFIG[round] || ROUND_CONFIG[5];
  const players = getPlayers();
  const aliveIds = players.filter(p => p.alive).map(p => p.uid);


  const chamberArr = Array(config.chambers).fill(false);
  let placed = 0;
  while (placed < config.bullets) {
    const idx = Math.floor(Math.random() * chamberArr.length);
    if (!chamberArr[idx]) {
      chamberArr[idx] = true;
      placed++;
    }
  }


  const newState = {
    round,
    phase: "playing",
    chambers: shuffleArray(chamberArr),
    chamberIndex: 0,
    bulletsLeft: config.bullets,
    shotsTaken: 0,
    shotLimit: getShotLimit(aliveIds.length),
    currentTurn: aliveIds[0],
    pendingSwap: null,
    effects: {}
  };


  const updates = { gameState: newState, status: "game" };
  await update(getRoomRef(), updates);
  await addRoomEvent(`${round}-ci raund başladı!`, "round");
}
/* ==========================================================================
   8. MAIN GAME SCREEN & GRAPHICS RENDER ENGINE
   ========================================================================== */


function renderRoom() {
  if (isPracticeMode) {
    renderPracticeGame();
    return;
  }
  if (!roomData) return;


  if (roomData.status === "lobby") renderLobby();
  else if (roomData.status === "cardSelection") renderCardSelection();
  else if (roomData.status === "game") renderGameScreen();
  else if (roomData.status === "ended") renderEndScreen();
}


function renderGameScreen() {
  showScreen("game");
  const state = roomData?.gameState;
  const players = roomData?.players || {};
  if (!state || !players) return;


  const alivePlayers = Object.values(players).filter(p => p.alive);
  setText("gameRoomCode", currentRoom || "----");
  setText("aliveCount", `${alivePlayers.length} OYUNÇU`);
  setText("roundLabel", `${state.round}/5`);
  setText("chamberCount", state.chambers?.length || 0);
  setText("bulletsLeft", state.bulletsLeft ?? 0);
  setText("shotsTaken", state.shotsTaken ?? 0);
  setText("shotLimit", state.shotLimit ?? 0);


  const curPlayer = players[state.currentTurn];
  setText("turnLabel", curPlayer ? `${getPlayerDisplayName(curPlayer)} oynayır` : "Növbə gözlənilir");


  renderSeats(players, state.currentTurn);
  renderActiveCards();
  renderLatestEvent(roomData.events || []);
  renderEventLog(roomData.events || []);


  const isMyTurn = state.currentTurn === uid;
  const canShoot = state.phase === "playing" && isMyTurn && !isShootingAnimation && !state.pendingSwap;


  const shootBtn = $("shootButton");
  if (shootBtn) {
    shootBtn.disabled = !canShoot || !selectedTarget;
    shootBtn.textContent = isMyTurn ? "HƏDƏFİ TƏSDİQLƏ VƏ ATƏŞ AÇ" : "NÖVBƏNİ GÖZLƏİN";
  }


  if (state.pendingSwap?.targetId === uid) {
    showSwapPrompt(state.pendingSwap.shooterId, state.pendingSwap.targetId);
  }
}


function renderSeats(playersMap, currentTurnId) {
  const seatList = $("seatList");
  if (!seatList) return;
  seatList.innerHTML = "";


  const entries = Object.entries(playersMap);
  entries.forEach(([id, player]) => {
    const character = getCharacter(player.character);
    const isCurrent = currentTurnId === id;
    const isMe = id === (isPracticeMode ? "practice-player" : uid);


    const seat = document.createElement("div");
    seat.className = `seat ${player.alive ? "" : "dead"} ${isCurrent ? "current-turn" : ""} ${selectedTarget === id ? "selected-target" : ""}`;
    seat.dataset.playerId = id;


    seat.innerHTML = `
      <div class="face">${character.face}</div>
      <div class="seat-name">${escapeHTML(getPlayerDisplayName(player))} ${isMe ? "(SƏN)" : ""}</div>
      <div class="seat-hearts">${"❤️".repeat(Math.max(0, player.hearts || 0))}</div>
    `;


    seat.addEventListener("click", () => {
      const activeId = isPracticeMode ? practiceState.currentTurn : roomData?.gameState?.currentTurn;
      const myId = isPracticeMode ? "practice-player" : uid;
      if (activeId !== myId) {
        showToast("Hələ sizin növbəniz deyil.");
        return;
      }
      if (player.alive) {
        selectedTarget = id;
        if (isPracticeMode) renderPracticeGame();
        else renderGameScreen();
      }
    });


    seatList.appendChild(seat);
  });
}


function renderActiveCards() {
  const container = $("activeCards");
  if (!container) return;
  container.innerHTML = "";


  const me = isPracticeMode ? practiceState.players["practice-player"] : getMyPlayer();
  if (!me) return;


  (me.selectedCards || []).forEach(cardId => {
    const card = CARD_DATA[cardId];
    if (!card) return;
    const used = (me.usedCards || []).includes(cardId);


    const btn = document.createElement("button");
    btn.className = `active-card ${used ? "used" : ""}`;
    btn.disabled = used;
    btn.textContent = `${card.name} ${used ? "(İSTİFADƏ OLUNDU)" : ""}`;


    btn.addEventListener("click", () => activateCard(cardId));
    container.appendChild(btn);
  });
}


/* ==========================================================================
   9. KART AKTİVLƏŞDİRMƏ VƏ EFFEKT LOGİKSİ
   ========================================================================== */


async function activateCard(cardId) {
  const myId = isPracticeMode ? "practice-player" : uid;
  const state = isPracticeMode ? practiceState : roomData?.gameState;
  const me = isPracticeMode ? practiceState.players[myId] : getMyPlayer();


  if (!state || state.phase !== "playing") return;
  if (state.currentTurn !== myId) {
    showToast("Kartı yalnız öz növbəndə istifadə edə bilərsən.");
    return;
  }
  if ((me.usedCards || []).includes(cardId)) return;


  if (cardId === "detective") {
    const nextBullet = state.chambers?.[state.chamberIndex];
    markCardUsed(cardId);
    showToast(nextBullet ? "Detektiv: Növbəti kamerada GÜLLƏ VAR!" : "Detektiv: Növbəti kamera BOŞDUR.");
    await addRoomEvent(`${getPlayerDisplayName(me)} Detektiv kartını istifadə etdi.`, "card");
    return;
  }


  if (cardId === "counter") {
    markCardUsed(cardId);
    setEffect("counter");
    showToast("Əks təsir aktivdir. Dəyən gülləni bloklayacaq.");
    await addRoomEvent(`${getPlayerDisplayName(me)} Əks təsir kartını aktivləşdirdi.`, "card");
    return;
  }


  if (cardId === "witch") {
    markCardUsed(cardId);
    setEffect("witch");
    showToast("İfritəlik aktivdir: Vurma ehtimalı 80%-ə yüksəldi.");
    await addRoomEvent(`${getPlayerDisplayName(me)} İfritəlik kartından istifadə etdi.`, "card");
    return;
  }


  if (cardId === "selfLove") {
    markCardUsed(cardId);
    setEffect("selfLove");
    showToast("Canını sevmək aktivdir: Özünə atəş açarkən vurulma şansı 25%-dir.");
    await addRoomEvent(`${getPlayerDisplayName(me)} Canını sevmək kartını aktivləşdirdi.`, "card");
    return;
  }


  if (cardId === "swap") {
    markCardUsed(cardId);
    setEffect("swap");
    showToast("Yerdəyişmə aktivdir. Sənə atəş açılanda zərbəni qaytaracaqsan.");
    await addRoomEvent(`${getPlayerDisplayName(me)} Yerdəyişmə kartını aktivləşdirdi.`, "card");
    return;
  }


  if (cardId === "evil") {
    markCardUsed(cardId);
    setEffect("evil");
    showToast("İbnəlik kartı aktivdir!");
    await addRoomEvent(`${getPlayerDisplayName(me)} İbnəlik kartını aktivləşdirdi.`, "card");
    return;
  }
}


function markCardUsed(cardId) {
  if (isPracticeMode) {
    const me = practiceState.players["practice-player"];
    me.usedCards = me.usedCards || [];
    if (!me.usedCards.includes(cardId)) me.usedCards.push(cardId);
    renderPracticeGame();
    return;
  }
  const used = getMyPlayer()?.usedCards || [];
  if (!used.includes(cardId)) {
    update(ref(db, `rooms/${currentRoom}/players/${uid}`), { usedCards: [...used, cardId] });
  }
}


function setEffect(effect) {
  const myId = isPracticeMode ? "practice-player" : uid;
  if (isPracticeMode) {
    practiceState.effects = practiceState.effects || {};
    practiceState.effects[myId] = practiceState.effects[myId] || {};
    practiceState.effects[myId][effect] = true;
    return;
  }
  update(getRoomRef(), { [`gameState/effects/${myId}/${effect}`]: true });
}
/* ==========================================================================
   10. ATƏŞ AÇMA VƏ ANİMASİYA MEXANİKASI
   ========================================================================== */


async function handleShootButton() {
  const myId = isPracticeMode ? "practice-player" : uid;
  const state = isPracticeMode ? practiceState : roomData?.gameState;
  const players = isPracticeMode ? practiceState.players : roomData?.players;


  if (!state || state.phase !== "playing") return;
  if (state.currentTurn !== myId) {
    showToast("Hələ sizin növbəniz deyil.");
    return;
  }
  if (!selectedTarget) {
    showToast("Əvvəlcə atəş açmaq üçün hədəf seçin.");
    return;
  }


  isShootingAnimation = true;
  await playShotAnimation(selectedTarget);


  if (isPracticeMode) {
    executePracticeShot(myId, selectedTarget);
  } else {
    executeOnlineShot(myId, selectedTarget);
  }
  isShootingAnimation = false;
}


async function playShotAnimation(targetId) {
  const gun = $("tableGun");
  const effect = $("shotEffect");
  const blackout = $("blackout");


  if (gun) gun.classList.add("aiming");
  await new Promise(r => setTimeout(r, 500));


  if (blackout) blackout.classList.add("active");
  if (effect) effect.classList.add("active");
  await new Promise(r => setTimeout(r, 800));


  if (blackout) blackout.classList.remove("active");
  if (effect) effect.classList.remove("active");
  if (gun) gun.classList.remove("aiming");
}


/* ==========================================================================
   11. BOTLARLA MƏŞQ REJİMİ LOR / ALQORİTM
   ========================================================================== */


function startPracticeMode() {
  let name = $("nickname")?.value?.trim() || "Oyunçu";
  const count = Number($("botCount")?.value || 3);
  isPracticeMode = true;
  currentRoom = null;


  const human = {
    nickname: name,
    character: CHARACTERS[0].id,
    hearts: 2,
    alive: true,
    selectedCards: [],
    usedCards: []
  };


  const players = { "practice-player": human };
  for (let i = 1; i <= count; i++) {
    players[`bot-${i}`] = {
      nickname: `BOT ${i}`,
      character: CHARACTERS[i % CHARACTERS.length].id,
      hearts: 2,
      alive: true,
      selectedCards: ["detective", "counter"],
      usedCards: []
    };
  }


  practiceState = {
    round: 1,
    phase: "cardSelection",
    players,
    chambers: [],
    chamberIndex: 0,
    bulletsLeft: 2,
    shotsTaken: 0,
    shotLimit: getShotLimit(count + 1),
    currentTurn: "practice-player",
    effects: {},
    events: [createEvent("Məşq rejimi başladı.", "system")]
  };


  selectedCards = [];
  showScreen("cardSelection");
  renderPracticeCardSelection();
}


function renderPracticeCardSelection() {
  const config = ROUND_CONFIG[practiceState.round] || ROUND_CONFIG[5];
  setText("cardRound", `RAUND ${practiceState.round}`);
  setText("cardsToChoose", config.cards);
  document.querySelectorAll(".game-card").forEach(b => b.classList.remove("selected"));
  const confirmBtn = $("confirmCards");
  if (confirmBtn) confirmBtn.disabled = true;
}


function togglePracticeCard(cardId) {
  const config = ROUND_CONFIG[practiceState.round] || ROUND_CONFIG[5];
  if (selectedCards.includes(cardId)) {
    selectedCards = selectedCards.filter(c => c !== cardId);
  } else {
    if (selectedCards.length < config.cards) selectedCards.push(cardId);
  }
  document.querySelectorAll(".game-card").forEach(btn => {
    btn.classList.toggle("selected", selectedCards.includes(btn.dataset.card));
  });
  const confirmBtn = $("confirmCards");
  if (confirmBtn) confirmBtn.disabled = selectedCards.length !== config.cards;
}


function confirmPracticeCards() {
  practiceState.players["practice-player"].selectedCards = [...selectedCards];
  startPracticeRound();
}


function startPracticeRound() {
  const config = ROUND_CONFIG[practiceState.round] || ROUND_CONFIG[5];
  const chamberArr = Array(config.chambers).fill(false);
  let placed = 0;
  while (placed < config.bullets) {
    const idx = Math.floor(Math.random() * chamberArr.length);
    if (!chamberArr[idx]) {
      chamberArr[idx] = true;
      placed++;
    }
  }


  practiceState.chambers = shuffleArray(chamberArr);
  practiceState.chamberIndex = 0;
  practiceState.bulletsLeft = config.bullets;
  practiceState.shotsTaken = 0;
  practiceState.shotLimit = getShotLimit(Object.keys(practiceState.players).length);
  practiceState.phase = "playing";
  practiceState.currentTurn = "practice-player";


  showScreen("game");
  renderPracticeGame();
  addRoomEvent(`${practiceState.round}-ci raund başladı!`, "round");
}


function renderPracticeGame() {
  showScreen("game");
  setText("gameRoomCode", "MƏŞQ");
  const players = practiceState.players;
  const alive = Object.values(players).filter(p => p.alive);


  setText("aliveCount", `${alive.length} OYUNÇU`);
  setText("roundLabel", `${practiceState.round}/5`);
  setText("chamberCount", practiceState.chambers.length);
  setText("bulletsLeft", practiceState.bulletsLeft);
  setText("shotsTaken", practiceState.shotsTaken);
  setText("shotLimit", practiceState.shotLimit);


  const isMyTurn = practiceState.currentTurn === "practice-player";
  setText("turnLabel", isMyTurn ? "Sənin növbəndir!" : `${players[practiceState.currentTurn]?.nickname} oynayır...`);


  renderSeats(players, practiceState.currentTurn);
  renderActiveCards();
  renderLatestEvent(practiceState.events || []);
  renderEventLog(practiceState.events || []);


  const shootBtn = $("shootButton");
  if (shootBtn) {
    shootBtn.disabled = !isMyTurn || !selectedTarget;
    shootBtn.textContent = isMyTurn ? "HƏDƏFİ TƏSDİQLƏ VƏ ATƏŞ AÇ" : "BOTUN HAMLESİ GÖZLƏNİLİR";
  }
}


function executePracticeShot(shooterId, targetId) {
  const players = practiceState.players;
  const shooter = players[shooterId];
  const target = players[targetId];


  const loaded = practiceState.chambers[practiceState.chamberIndex];
  practiceState.chamberIndex++;
  practiceState.shotsTaken++;
  if (loaded) practiceState.bulletsLeft--;


  const shooterEffects = practiceState.effects?.[shooterId] || {};
  const targetEffects = practiceState.effects?.[targetId] || {};


  let hit = loaded;
  if (shooterEffects.witch) hit = Math.random() < 0.8;
  if (targetId === shooterId && shooterEffects.selfLove) hit = Math.random() < 0.25;


  let msg = "";
  if (shooterEffects.evil) {
    if (hit) {
      target.hearts = 0;
      target.alive = false;
      msg = `${target.nickname} İbnəlik kartı ilə birbaşa oyundan çıxarıldı!`;
    } else {
      shooter.hearts = Math.max(0, shooter.hearts - 1);
      if (shooter.hearts <= 0) shooter.alive = false;
      msg = `${shooter.nickname} İbnəlik kartı boş çıxdığı üçün 1 can itirdi.`;
    }
  } else if (hit) {
    if (targetEffects.counter) {
      practiceState.effects[targetId].counter = false;
      target.hearts = Math.min(3, target.hearts + 1);
      msg = `${target.nickname} Əks təsir ilə vurulmaqdan qorundu və +1 can qazandı!`;
    } else if (targetEffects.swap) {
      practiceState.effects[targetId].swap = false;
      shooter.hearts = Math.max(0, shooter.hearts - 1);
      if (shooter.hearts <= 0) shooter.alive = false;
      msg = `${target.nickname} Yerdəyişmə etdi! Zərbə ${shooter.nickname}-ə dəydi.`;
    } else {
      target.hearts = Math.max(0, target.hearts - 1);
      if (target.hearts <= 0) target.alive = false;
      msg = `BANG! Güllə dolu idi. ${target.nickname} 1 can itirdi.`;
    }
  } else {
    msg = `KLİK! Güllə boş idi. ${target.nickname} xəsarət almadı.`;
  }


  // Effetləri sıfırla
  practiceState.effects[shooterId] = {};


  addRoomEvent(msg, hit ? "danger" : "normal");
  selectedTarget = null;
  checkPracticeRoundOrEnd();
}


function checkPracticeRoundOrEnd() {
  const players = practiceState.players;
  const aliveBots = Object.entries(players).filter(([id, p]) => id !== "practice-player" && p.alive);
  const human = players["practice-player"];


  if (!human.alive) {
    renderPracticeEnd(null);
    return;
  }


  if (aliveBots.length === 0) {
    renderPracticeEnd(human);
    return;
  }


  if (practiceState.chamberIndex >= practiceState.chambers.length || practiceState.shotsTaken >= practiceState.shotLimit) {
    practiceState.round++;
    if (practiceState.round > 5) {
      renderPracticeEnd(human);
      return;
    }
    addRoomEvent(`${practiceState.round - 1}-ci raund başa çatdı. Növbəti raund başlayır!`, "system");
    renderPracticeCardSelection();
    showScreen("cardSelection");
    return;
  }


  practiceState.currentTurn = aliveBots[0][0];
  renderPracticeGame();
  clearTimeout(botTurnTimeout);
  botTurnTimeout = setTimeout(botTurnLogic, 1400);
}


function botTurnLogic() {
  if (!isPracticeMode || practiceState.currentTurn === "practice-player") return;
  const botId = practiceState.currentTurn;
  const bot = practiceState.players[botId];
  if (!bot || !bot.alive) return;


  const targets = Object.keys(practiceState.players).filter(id => id !== botId && practiceState.players[id].alive);
  if (!targets.length) return;
  const targetId = randomItem(targets);


  // Bot Kart IQ-sü
  practiceState.effects[botId] = practiceState.effects[botId] || {};
  if (bot.selectedCards.includes("counter") && !bot.usedCards.includes("counter") && bot.hearts === 1) {
    bot.usedCards.push("counter");
    practiceState.effects[botId].counter = true;
    addRoomEvent(`${bot.nickname} Əks təsir kartını aktivləşdirdi.`, "card");
  }


  playShotAnimation(targetId).then(() => {
    executePracticeShot(botId, targetId);
  });
}


function renderPracticeEnd(winner) {
  showScreen("ended");
  setText("winnerTitle", winner ? `${winner.nickname} QALİB OLDU!` : "MƏĞLUB OLDUNUZ");
  setText("winnerText", winner ? "Masanın sonuncu sağ qalan sahibisiniz!" : "Masa arxasında həyatınızı itirdiniz.");
}
/* ==========================================================================
   12. ONLAYN OYUN ATƏŞ VƏ YERDƏYİŞMƏ MEXANİKASI
   ========================================================================== */


async function executeOnlineShot(shooterId, targetId) {
  if (!isHost()) return;
  const state = roomData.gameState;
  const players = roomData.players || {};


  const loaded = state.chambers[state.chamberIndex];
  const nextIndex = state.chamberIndex + 1;
  const nextShots = state.shotsTaken + 1;


  const updates = {};
  updates["gameState/chamberIndex"] = nextIndex;
  updates["gameState/bulletsLeft"] = Math.max(0, state.bulletsLeft - (loaded ? 1 : 0));
  updates["gameState/shotsTaken"] = nextShots;


  const shooter = players[shooterId];
  const target = players[targetId];


  let msg = "";
  if (loaded) {
    const targetEffects = state.effects?.[targetId] || {};
    if (targetEffects.counter) {
      updates[`gameState/effects/${targetId}/counter`] = null;
      updates[`players/${targetId}/hearts`] = Math.min(3, target.hearts + 1);
      msg = `${getPlayerDisplayName(target)} Əks təsir ilə qorundu!`;
    } else if (targetEffects.swap) {
      updates["gameState/pendingSwap"] = { shooterId, targetId };
      await update(getRoomRef(), updates);
      return;
    } else {
      const newHearts = Math.max(0, target.hearts - 1);
      updates[`players/${targetId}/hearts`] = newHearts;
      if (newHearts <= 0) updates[`players/${targetId}/alive`] = false;
      msg = `${getPlayerDisplayName(target)} vuruldu və 1 can itirdi.`;
    }
  } else {
    msg = "Atəş açıldı — Güllə boş idi.";
  }


  const alive = getAlivePlayers(players);
  if (alive.length <= 1) {
    updates["gameState/phase"] = "gameEnd";
    updates["gameState/winner"] = alive[0] ? getPlayerDisplayName(alive[0]) : "Heç kim";
  } else if (nextShots >= state.shotLimit || nextIndex >= state.chambers.length) {
    updates["gameState/phase"] = "roundEnd";
  } else {
    const nextPlayer = getNextAlivePlayer(players, shooterId);
    updates["gameState/currentTurn"] = nextPlayer;
  }


  await update(getRoomRef(), updates);
  await addRoomEvent(msg, loaded ? "danger" : "normal");
}


function getNextAlivePlayer(players, currentId) {
  const ids = Object.keys(players);
  const curIdx = ids.indexOf(currentId);
  for (let i = 1; i <= ids.length; i++) {
    const nextId = ids[(curIdx + i) % ids.length];
    if (players[nextId]?.alive) return nextId;
  }
  return currentId;
}


function showSwapPrompt(shooterId, targetId) {
  const modal = $("swapPrompt");
  if (!modal) return;
  const shooter = (isPracticeMode ? practiceState.players : roomData.players)[shooterId];
  setText("swapMessage", `${getPlayerDisplayName(shooter)} səni hədəfə aldı. Zərbəni ona qaytarmaq istəyirsən?`);
  modal.classList.add("active");
}


async function answerSwap(accept) {
  const modal = $("swapPrompt");
  if (modal) modal.classList.remove("active");


  if (isPracticeMode) {
    const pending = practiceState.pendingSwap;
    if (!pending) return;
    const shooter = practiceState.players[pending.shooterId];
    const target = practiceState.players[pending.targetId];


    if (accept) {
      shooter.hearts = Math.max(0, shooter.hearts - 1);
      if (shooter.hearts <= 0) shooter.alive = false;
      addRoomEvent(`${target.nickname} Yerdəyişmə etdi! ${shooter.nickname} 1 can itirdi.`, "danger");
    } else {
      target.hearts = Math.max(0, target.hearts - 1);
      if (target.hearts <= 0) target.alive = false;
      addRoomEvent(`${target.nickname} Yerdəyişmədən imtina etdi və vuruldu.`, "danger");
    }
    practiceState.pendingSwap = null;
    checkPracticeRoundOrEnd();
    return;
  }


  // Onlayn Swap Logic
  const state = roomData.gameState;
  const pending = state?.pendingSwap;
  if (!pending) return;


  const updates = { "gameState/pendingSwap": null };
  const target = roomData.players[pending.targetId];
  const shooter = roomData.players[pending.shooterId];


  if (accept) {
    const h = Math.max(0, shooter.hearts - 1);
    updates[`players/${pending.shooterId}/hearts`] = h;
    if (h <= 0) updates[`players/${pending.shooterId}/alive`] = false;
    await addRoomEvent(`${getPlayerDisplayName(target)} Yerdəyişmə kartını işlətdi!`, "danger");
  } else {
    const h = Math.max(0, target.hearts - 1);
    updates[`players/${pending.targetId}/hearts`] = h;
    if (h <= 0) updates[`players/${pending.targetId}/alive`] = false;
    await addRoomEvent(`${getPlayerDisplayName(target)} Yerdəyişmədən imtina etdi.`, "danger");
  }


  await update(getRoomRef(), updates);
}


function renderEndScreen() {
  showScreen("ended");
  const winner = roomData?.gameState?.winner;
  setText("winnerTitle", winner ? `${winner} QALİB OLDU!` : "OYUN BİTDİ");
  setText("winnerText", "Masa arxasında döyüş başa çatdı.");
}


/* ==========================================================================
   13. DÜYMƏ VƏ İNTERFEYS CONTROL EVENT BİNDİNGS
   ========================================================================== */


function setupControls() {
  $("createRoom")?.addEventListener("click", createRoom);
  $("joinRoom")?.addEventListener("click", joinRoom);
  $("practiceButton")?.addEventListener("click", startPracticeMode);
  $("openRules")?.addEventListener("click", () => showScreen("rules"));
  $("closeRules")?.addEventListener("click", () => showScreen("home"));
  $("readyButton")?.addEventListener("click", toggleReady);
  $("startGame")?.addEventListener("click", startGame);
  $("confirmCards")?.addEventListener("click", confirmCards);
  $("shootButton")?.addEventListener("click", handleShootButton);
  $("acceptSwap")?.addEventListener("click", () => answerSwap(true));
  $("declineSwap")?.addEventListener("click", () => answerSwap(false));


  $("backHome")?.addEventListener("click", () => {
    isPracticeMode = false;
    practiceState = null;
    currentRoom = null;
    unsubscribeRoom();
    showScreen("home");
  });


  $("leaveLobby")?.addEventListener("click", () => {
    unsubscribeRoom();
    currentRoom = null;
    showScreen("home");
  });


  $("leaveGame")?.addEventListener("click", () => {
    unsubscribeRoom();
    currentRoom = null;
    showScreen("home");
  });


  document.querySelectorAll(".game-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const cardId = btn.dataset.card;
      if (cardId) toggleCard(cardId);
    });
  });


  const select = $("characterSelect");
  if (select) {
    select.addEventListener("change", e => changeCharacter(e.target.value));
  }
}


document.addEventListener("DOMContentLoaded", () => {
  setupControls();
  showScreen("home");
  console.log("%cMASA ARXASINDA Engine Ready!", "color:#54e39a;font-weight:bold;font-size:14px;");
});
