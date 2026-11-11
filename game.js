/* MASA ARXASINDA GAME.JS - FIXED BUTTON INTERACTIONS */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = { apiKey: "AIzaSyBFFVigbO3r5vZbl7vfgzVboChHjXn2h-A", authDomain: "behind-table.firebaseapp.com", databaseURL: "https://behind-table-default-rtdb.firebaseio.com", projectId: "behind-table", storageBucket: "behind-table.firebasestorage.app", messagingSenderId: "637325725035", appId: "1:637325725035:web:696bb4b800ed5ba713d02e", measurementId: "G-EJN8J5HFGD" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let uid = null; let currentRoom = null; let roomData = null;
let roomUnsub = null; let authReady = false; let busy = false;
let selectedCards = []; let selectedTarget = null;
let lastEventId = null;
let isPracticeMode = false; let practiceState = null;
let toastTimeout = null;
const $ = (id) => document.getElementById(id);

const CHARACTERS = [ 
  { id: "moto", name: "Moto moto", face: "😎" }, 
  { id: "polat", name: "Polat Amımdar", face: "🕶️" }, 
  { id: "lez", name: "Lez Ziya", face: "🤠" }, 
  { id: "memesbas", name: "Məməşbaş", face: "🤓" }, 
  { id: "emdul", name: "Əmdüley", face: "🥸" }, 
  { id: "maygulu", name: "Maygülü", face: "😈" }, 
  { id: "emesgeri", name: "Əməsgəri", face: "👽" }, 
  { id: "totes", name: "Tötəş", face: "🤡" }, 
  { id: "amir", name: "Əmir", face: "🧐" }, 
  { id: "chuban", name: "Çuban Ələddin", face: "🤖" } 
];

const CARD_DATA = { 
  detective: { id: "detective", name: "Detektiv", icon: "🔎", description: "Növbəti kamerada güllə olub-olmadığını öyrən." },
  swap: { id: "swap", name: "Yerdəyişmə", icon: "🔄", description: "Sənə atəş açıldıqda zərbəni hücumçuya yönəlt." },
  counter: { id: "counter", name: "Əks təsir", icon: "🛡️", description: "Dolu güllə səni vurarsa, zərəri blokla və can qazan." },
  witch: { id: "witch", name: "İfritəlik", icon: "🧙", description: "Seçilmiş hədəfə növbəti atəşin vurma şansı 80% olsun." },
  selfLove: { id: "selfLove", name: "Canını sevmək", icon: "❤️", description: "Özünə atəş açanda vurulma ehtimalını 1/4-ə endir." },
  evil: { id: "evil", name: "İbnəlik", icon: "☠️", description: "Dolu güllə hədəfi dərhal öldürür; boş çıxarsa, özün 1 can itirirsən." } 
};

const ROUND_CONFIG = { 
  1: { chambers: 6, bullets: 2, cards: 1, selectionTime: 30, automaticCards: false },
  2: { chambers: 8, bullets: 3, cards: 2, selectionTime: 30, automaticCards: false },
  3: { chambers: 9, bullets: 4, cards: 2, selectionTime: 30, automaticCards: false },
  4: { chambers: 9, bullets: 5, cards: 3, selectionTime: 30, automaticCards: false },
  5: { chambers: 12, bullets: 7, cards: 3, selectionTime: 0, automaticCards: true } 
};

function randomId(length = 12) { 
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) { result += chars[Math.floor(Math.random() * chars.length)]; }
  return result; 
}

function makeRoomCode() { 
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) { code += chars[Math.floor(Math.random() * chars.length)]; }
  return code; 
}

function randomItem(array) { return array[Math.floor(Math.random() * array.length)]; }
function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': '"', "'": "'" }[c])); }
function getCharacter(characterId) { return CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0]; }
function getPlayerName(player) { return player?.nickname || player?.name || "Naməlum"; }
function getRoundConfig(round) { return ROUND_CONFIG[round] || ROUND_CONFIG[5]; }
function setText(id, value) { const el = $(id); if (el) el.textContent = value; }

function showScreen(screenId) { 
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
  const target = $(screenId);
  if (target) target.classList.add("active"); 
}

function setBusy(value) { 
  busy = value;
  document.querySelectorAll("button").forEach(button => { 
    if (button.dataset.ignoreBusy === "true") return;
    button.disabled = value; 
  }); 
}

function showToast(message) { 
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message; 
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2600); 
}

function showError(message) { 
  const error = $("homeError");
  if (error) error.textContent = message; else showToast(message); 
}

function clearError() { 
  const error = $("homeError");
  if (error) error.textContent = ""; 
}

function getNickname() { 
  const name = $("nickname")?.value?.trim() || "";
  if (name.length < 2) throw new Error("Ləqəb ən azı 2 simvoldan ibarət olmalıdır.");
  if (name.length > 18) throw new Error("Ləqəb maksimum 18 simvol ola bilər.");
  return name; 
}

function requireAuth() { if (!authReady || !uid) throw new Error("Serverə qoşulma gözlənilir."); }
function getRoomRef() { if (!currentRoom) throw new Error("Hazırda otaqda deyilsən."); return ref(db, `rooms/${currentRoom}`); }
function getMyPlayer() { if (!roomData || !uid) return null; return roomData.players?.[uid] || null; }
function isHost() { return roomData?.host === uid; }
function getPlayers() { if (!roomData?.players) return []; return Object.entries(roomData.players).map(([id, player]) => ({ ...player, uid: id })); }

onAuthStateChanged(auth, async (user) => { 
  if (user) { 
    uid = user.uid; authReady = true;
    setText("connection", "● SERVERƏ BAĞLI");
    if ($("connection")) $("connection").style.color = "#54e39a";
  } else { 
    authReady = false;
    setText("connection", "● BAĞLANTI GÖZLƏNİLİR");
    try { await signInAnonymously(auth); } catch (e) { showToast("Serverə qoşulmaq olmadı."); } 
  } 
});

async function createRoom() { 
  if (busy) return;
  clearError();
  try { 
    requireAuth();
    const name = getNickname();
    setBusy(true);
    let roomCode = makeRoomCode();
    const newRoom = { 
      status: "lobby", host: uid, createdAt: Date.now(), round: 1, currentTurn: uid,
      players: { [uid]: { uid, name, character: CHARACTERS[0].id, alive: true, hearts: 2, ready: false, cardReady: false, selectedCards: [], usedCards: [], isBot: false } },
      events: [{ id: randomId(), message: `${name} otağı yaratdı.`, type: "system", time: Date.now() }]
    };
    await set(ref(db, `rooms/${roomCode}`), newRoom);
    subscribeRoom(roomCode);
    showToast(`Otaq yaradıldı: ${roomCode}`);
  } catch (error) { 
    showError(error.message); 
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
    if (!code || code.length !== 4) throw new Error("4 simvollu otaq kodunu daxil et.");
    setBusy(true);
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) throw new Error("Belə otaq tapılmadı.");
    const data = snap.val();
    if (data.status !== "lobby") throw new Error("Bu otaqda oyun başlayıb.");
    
    const newPlayer = { uid, name, character: CHARACTERS[0].id, alive: true, hearts: 2, ready: false, cardReady: false, selectedCards: [], usedCards: [], isBot: false };
    await update(ref(db, `rooms/${code}/players/${uid}`), newPlayer);
    subscribeRoom(code);
    showToast("Otağa uğurla qoşuldun!");
  } catch (error) { 
    showError(error.message); 
  } finally { 
    setBusy(false); 
  } 
}

function subscribeRoom(roomCode) {
  if (roomUnsub) roomUnsub();
  currentRoom = roomCode;
  roomUnsub = onValue(ref(db, `rooms/${roomCode}`), snapshot => {
    if (!snapshot.exists()) {
      roomData = null; currentRoom = null;
      showScreen("home");
      return;
    }
    roomData = snapshot.val();
    renderRoom();
  });
}

function renderRoom() {
  if (isPracticeMode) { renderPracticeGame(); return; }
  if (!roomData) return;
  if (roomData.status === "lobby") renderLobby();
  else if (roomData.status === "cardSelection") renderCardSelection();
  else if (roomData.status === "game") renderGameScreen();
  else if (roomData.status === "ended") showScreen("ended");
}

function renderLobby() {
  showScreen("lobby");
  setText("roomCodeDisplay", currentRoom || "----");
  const players = getPlayers();
  setText("playerCount", `${players.length}/10`);
  const list = $("playerList");
  if (list) {
    list.innerHTML = players.map(p => `
      <div class="player-item ${p.uid === roomData.host ? 'host' : ''}">
        <span class="player-avatar">${getCharacter(p.character).face}</span>
        <span class="player-name">${escapeHTML(p.name)}</span>
        <span class="host-label">${p.uid === roomData.host ? 'HOST' : (p.ready ? 'HAZIR' : 'GÖZLƏYİR')}</span>
      </div>
    `).join("");
  }
  const me = getMyPlayer();
  setText("readyStatus", me?.ready ? "Hazırsan!" : "Hələ hazır deyilsən.");
  const startBtn = $("startGame");
  if (startBtn) {
    startBtn.style.display = isHost() ? "" : "none";
    startBtn.disabled = !(players.length >= 2 && players.every(p => p.ready));
  }
}

async function toggleReady() {
  const me = getMyPlayer();
  if (!me || !currentRoom) return;
  await update(ref(db, `rooms/${currentRoom}/players/${uid}`), { ready: !me.ready });
}

async function startGame() {
  if (!isHost()) return;
  await update(getRoomRef(), { status: "cardSelection", round: 1 });
}

function renderCardSelection() {
  showScreen("cardSelection");
  const me = getMyPlayer();
  const round = roomData?.round || 1;
  const config = getRoundConfig(round);
  setText("cardRound", round);
  setText("cardsToChoose", config.cards);
  
  document.querySelectorAll(".game-card").forEach(btn => {
    const cardId = btn.dataset.card;
    const isSelected = (me?.selectedCards || []).includes(cardId);
    btn.classList.toggle("selected", isSelected);
  });

  const confirmBtn = $("confirmCards");
  if (confirmBtn) {
    confirmBtn.disabled = me?.cardReady || ((me?.selectedCards || []).length !== config.cards);
  }
}

function toggleCard(cardId) {
  if (isPracticeMode) {
    const config = getRoundConfig(practiceState.round);
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
    return;
  }
  const me = getMyPlayer();
  if (!me || me.cardReady) return;
  const config = getRoundConfig(roomData?.round || 1);
  let cur = [...(me.selectedCards || [])];
  if (cur.includes(cardId)) cur = cur.filter(c => c !== cardId);
  else if (cur.length < config.cards) cur.push(cardId);
  update(ref(db, `rooms/${currentRoom}/players/${uid}`), { selectedCards: cur });
}

async function confirmCards() {
  if (isPracticeMode) {
    practiceState.players["practice-player"].selectedCards = [...selectedCards];
    startPracticeRound();
    return;
  }
  await update(ref(db, `rooms/${currentRoom}/players/${uid}`), { cardReady: true });
}

/* PRACTICE MODE */
function startPracticeMode() {
  let name = $("nickname")?.value?.trim();
  if (!name) {
    name = "Oyunçu";
    if ($("nickname")) $("nickname").value = name;
  }
  const count = Number($("botCount")?.value || 3);
  isPracticeMode = true;
  currentRoom = null;
  const human = { nickname: name, character: CHARACTERS[0].id, hearts: 2, alive: true, selectedCards: [], usedCards: [] };
  const players = { "practice-player": human };
  for (let i = 1; i <= count; i++) {
    players[`bot-${i}`] = { nickname: `BOT ${i}`, character: CHARACTERS[i % CHARACTERS.length].id, hearts: 2, alive: true, selectedCards: ["detective"], usedCards: [] };
  }
  practiceState = { round: 1, phase: "cardSelection", players, chambers: [true, false, false, true, false, false], chamberIndex: 0, bulletsLeft: 2, shotsTaken: 0, shotLimit: 2, currentTurn: "practice-player", events: [] };
  selectedCards = [];
  showScreen("cardSelection");
  renderPracticeCardSelection();
}

function renderPracticeCardSelection() {
  const config = getRoundConfig(practiceState.round);
  setText("cardRound", practiceState.round);
  setText("cardsToChoose", config.cards);
  document.querySelectorAll(".game-card").forEach(b => b.classList.remove("selected"));
  const confirmBtn = $("confirmCards");
  if (confirmBtn) confirmBtn.disabled = true;
}

function startPracticeRound() {
  practiceState.phase = "playing";
  showScreen("game");
  renderPracticeGame();
}

function renderPracticeGame() {
  showScreen("game");
  setText("gameRoomCode", "MƏŞQ");
  const players = practiceState.players;
  const alive = Object.values(players).filter(p => p.alive);
  setText("aliveCount", alive.length);
  setText("roundLabel", practiceState.round);
  setText("turnLabel", practiceState.currentTurn === "practice-player" ? "Sənin növbəndir!" : `${players[practiceState.currentTurn]?.nickname} oynayır...`);

  const seatList = $("seatList");
  if (seatList) {
    seatList.innerHTML = Object.entries(players).map(([id, p]) => `
      <div class="seat ${p.alive ? '' : 'dead'} ${selectedTarget === id ? 'selected-target' : ''}" data-player-id="${id}">
        <div class="face">${getCharacter(p.character).face}</div>
        <div class="seat-name">${escapeHTML(p.nickname)}</div>
        <div class="seat-hearts">${"❤️".repeat(p.hearts)}</div>
      </div>
    `).join("");

    seatList.querySelectorAll(".seat").forEach(seat => {
      seat.addEventListener("click", () => {
        const pId = seat.dataset.playerId;
        if (pId !== "practice-player" && players[pId]?.alive) {
          selectedTarget = pId;
          renderPracticeGame();
        }
      });
    });
  }

  const shootBtn = $("shootButton");
  if (shootBtn) {
    const isMyTurn = practiceState.currentTurn === "practice-player";
    shootBtn.disabled = !isMyTurn || !selectedTarget;
    shootBtn.textContent = isMyTurn ? "HƏDƏFİ TƏSDİQLƏ VƏ ATƏŞ AÇ" : "BOTUN HAMLESİ GÖZLƏNİLİR";
  }
}

function handleShoot() {
  if (isPracticeMode) {
    if (practiceState.currentTurn !== "practice-player" || !selectedTarget) return;
    const target = practiceState.players[selectedTarget];
    const isLoaded = practiceState.chambers[practiceState.chamberIndex];
    practiceState.chamberIndex++;
    if (isLoaded) {
      target.hearts--;
      if (target.hearts <= 0) target.alive = false;
      showToast(`${target.nickname} vuruldu! 1 can itirdi.`);
    } else {
      showToast("Güllə boş çıxdı!");
    }
    selectedTarget = null;
    const aliveBots = Object.keys(practiceState.players).filter(id => id !== "practice-player" && practiceState.players[id].alive);
    if (aliveBots.length === 0) {
      showScreen("ended");
      setText("winnerTitle", "QƏLƏBƏ!");
      setText("winnerText", "Bütün botları məğlub etdin!");
      return;
    }
    practiceState.currentTurn = aliveBots[0];
    renderPracticeGame();
    setTimeout(botTurn, 1200);
  }
}

function botTurn() {
  if (!isPracticeMode || practiceState.currentTurn === "practice-player") return;
  const botId = practiceState.currentTurn;
  const human = practiceState.players["practice-player"];
  const isLoaded = practiceState.chambers[practiceState.chamberIndex];
  practiceState.chamberIndex++;
  if (isLoaded && human.alive) {
    human.hearts--;
    if (human.hearts <= 0) human.alive = false;
    showToast(`${practiceState.players[botId].nickname} sənə atəş açdı! 1 can itirdin.`);
  } else {
    showToast(`${practiceState.players[botId].nickname} atəş açdı - BOŞ!`);
  }
  if (!human.alive) {
    showScreen("ended");
    setText("winnerTitle", "OYUN BİTDİ");
    setText("winnerText", "Məğlub oldun!");
    return;
  }
  practiceState.currentTurn = "practice-player";
  renderPracticeGame();
}

function setupEvents() {
  $("createRoom")?.addEventListener("click", createRoom);
  $("joinRoom")?.addEventListener("click", joinRoom);
  $("practiceButton")?.addEventListener("click", startPracticeMode);
  $("openRules")?.addEventListener("click", () => showScreen("rules"));
  $("closeRules")?.addEventListener("click", () => showScreen("home"));
  $("readyButton")?.addEventListener("click", toggleReady);
  $("startGame")?.addEventListener("click", startGame);
  $("confirmCards")?.addEventListener("click", confirmCards);
  $("shootButton")?.addEventListener("click", handleShoot);
  $("leaveLobby")?.addEventListener("click", () => showScreen("home"));
  $("leaveGame")?.addEventListener("click", () => showScreen("home"));
  $("backHome")?.addEventListener("click", () => showScreen("home"));

  document.querySelectorAll(".game-card").forEach(btn => {
    btn.addEventListener("click", () => toggleCard(btn.dataset.card));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupEvents();
  showScreen("home");
});
