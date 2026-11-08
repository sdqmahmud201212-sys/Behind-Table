import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBFFigbO3r5vZbl7vfgzVboChHjXn2h-A",
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

const CHARACTERS = ["Moto moto","Polat Amımdar","Lez Ziya","Məməşbaş","Əmdüley","Maygülü","Siksoran","Tötəş","Əmir","Çuban Ələddin"];
const $ = id => document.getElementById(id);
let uid = null, currentRoom = null, roomUnsub = null, roomData = null, selectedTarget = null, busy = false;
const screens = ["home","lobby","game","ended"];

function showScreen(name){
  screens.forEach(id => $(id).classList.toggle("active", id===name));
  window.scrollTo(0,0);
}
function toast(message){
  const el=$("toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2600);
}
function setError(id,msg){$(id).textContent=msg||"";}
function cleanName(value){return value.trim().replace(/[.#$/\[\]]/g,"").slice(0,18);}
function code4(){return Math.random().toString(36).slice(2,6).toUpperCase();}
function roomRef(code){return ref(db,`rooms/${code}`);}
function me(){return roomData?.players?.[uid]||null;}
function alivePlayers(data=roomData){return Object.values(data?.players||{}).filter(p=>p.alive!==false);}
function isHost(){return !!roomData && roomData.hostId===uid;}
function currentTurn(){return roomData?.game?.turnPlayerId===uid;}
function logEntry(text){return {text,at:Date.now()};}
function addLog(state,text){
  state.game.log=state.game.log||[];
  state.game.log.push(logEntry(text));
  if(state.game.log.length>30) state.game.log=state.game.log.slice(-30);
}
function subscribeRoom(code){
  if(roomUnsub) roomUnsub();
  currentRoom=code;
  roomUnsub=onValue(roomRef(code),snap=>{
    if(!snap.exists()){toast("Otaq tapılmadı.");leaveRoom(false);return;}
    roomData=snap.val();
    renderRoom();
  },err=>toast("Otaq oxunmadı: "+err.message));
}
function renderRoom(){
  if(!roomData) return;
  const state=roomData.state||"lobby";
  $("roomCodeDisplay").textContent=currentRoom;
  $("gameRoomCode").textContent=currentRoom;
  const players=Object.entries(roomData.players||{});
  $("playerCount").textContent=`${players.length}/10`;
  $("playerList").innerHTML=players.map(([id,p])=>`
    <div class="player-row"><span>${escapeHtml(p.name)}${id===uid?'<b class="you"> (SƏN)</b>':''}</span>
    <span class="role">${id===roomData.hostId?"HOST":escapeHtml(p.character||"")}</span></div>`).join("");
  $("characterSelect").value=me()?.character||CHARACTERS[0];
  $("startGame").style.display=isHost()?"block":"none";
  $("lobbyHint").textContent=isHost()?"Hazır olan dostlarınla oyuna başla. Minimum 2, maksimum 10 oyunçu.":"Host oyunu başladana qədər gözlə.";
  if(state==="lobby") showScreen("lobby");
  if(state==="playing"){showScreen("game");renderGame();}
  if(state==="ended"){showScreen("ended");renderEnd();}
}
function renderGame(){
  if(!roomData?.game) return;
  const g=roomData.game, alive=alivePlayers();
  $("aliveCount").textContent=`${alive.length} OYUNÇU`;
  $("roundLabel").textContent=`FİLDƏ ${g.chamber+1}/6`;
  const turn=roomData.players?.[g.turnPlayerId];
  $("turnLabel").textContent=turn?`NÖVBƏ: ${turn.name}`:"NÖVBƏ BİTDİ";
  const all=Object.entries(roomData.players||{});
  const centerX=50, centerY=50, rx=43, ry=43;
  const seats=all.map(([id,p],i)=>{
    const angle=(-Math.PI/2)+(2*Math.PI*i/Math.max(all.length,1));
    const x=centerX+rx*Math.cos(angle), y=centerY+ry*Math.sin(angle);
    return `<div class="seat ${p.alive===false?"dead":""} ${id===g.turnPlayerId?"current":""}" style="left:${x}%;top:${y}%">
      <div class="avatar">${escapeHtml((p.character||p.name).slice(0,1).toUpperCase())}</div>
      <div class="seat-name">${escapeHtml(p.character||p.name)}</div>
      <div class="seat-char">${escapeHtml(p.name)}</div>
    </div>`;
  }).join("");

  // Masanın mərkəzində fırlanan revolver vizualı.
  $("seatList").innerHTML=seats+`
    <div class="table-gun" aria-label="Fırlanan revolver">
      <svg viewBox="0 0 180 90" role="img" aria-hidden="true">
        <path class="gun-barrel" d="M88 30 L164 30 L164 48 L88 48 Z"/>
        <path class="gun-top" d="M78 26 L111 26 L111 52 L78 52 Z"/>
        <circle class="gun-cylinder" cx="75" cy="39" r="18"/>
        <circle class="gun-cylinder-hole" cx="75" cy="39" r="8"/>
        <path class="gun-frame" d="M57 29 L39 29 Q28 29 28 40 Q28 51 40 51 L56 51 L68 60 L91 60 L103 51 L103 27 L88 27 L88 34 L65 34 Z"/>
        <path class="gun-handle" d="M49 49 L70 54 L62 82 Q60 87 54 84 L39 75 Q35 72 39 66 Z"/>
        <path class="gun-trigger" d="M94 51 Q107 59 96 68" fill="none"/>
        <circle class="gun-screw" cx="48" cy="40" r="3"/>
      </svg>
    </div>`;

  const canAct=currentTurn() && me()?.alive!==false;
  $("actionTitle").textContent=canAct?"SƏNİN NÖVBƏNDİR":"NÖVBƏ GÖZLƏNİLİR";
  $("actionDescription").textContent=canAct?"Hədəf seç. Özünü də hədəf göstərə bilərsən. Seçimini təsdiqləyəndən sonra atəş açılacaq.":turn?`${turn.name} hədəf seçir...`:"Oyun davam edir.";

  // ƏVVƏLKİ SƏHV: alivePlayers() obyektlər qaytarır, [id, player] cütləri yox.
  // Hədəfləri birbaşa players obyektindən ID ilə götürürük.
  const targets=Object.entries(roomData.players||{})
    .filter(([id,p])=>id!==uid && p.alive!==false);
  const options=canAct?[...targets,[uid,me()]]:[];
  $("targetArea").innerHTML=options.map(([id,p])=>`<button class="target-option ${selectedTarget===id?"selected":""}" data-target="${id}">${escapeHtml(p.character||p.name)}${id===uid?" (ÖZÜN)":""}<small>${escapeHtml(p.name)}</small></button>`).join("");
  $("targetArea").querySelectorAll("[data-target]").forEach(btn=>btn.addEventListener("click",()=>{
    selectedTarget=btn.dataset.target; renderGame();
  }));
  $("shootButton").disabled=!canAct||!selectedTarget||busy;
  $("shootButton").textContent=busy?"GÖZLƏ...":"HƏDƏFİ TƏSDİQLƏ VƏ ATƏŞ AÇ";
  const log=(g.log||[]).slice().reverse();
  $("eventLog").innerHTML=log.map(item=>`<div class="event">${escapeHtml(item.text)}</div>`).join("");
}
function renderEnd(){
  const alive=alivePlayers();
  const winner=alive[0];
  $("winnerTitle").textContent=winner?escapeHtml(winner.character||winner.name):"HEÇ KİM";
  $("winnerText").textContent=winner?`${winner.name} — MASANIN SONUNCU SAHİBİ.`:"Bu oyunda qalib olmadı.";
}
function escapeHtml(str=""){
  return String(str).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
async function createRoom(){
  const name=cleanName($("nickname").value);
  if(!name){setError("homeError","Əvvəlcə oyunçu adını yaz.");return;}
  if(!uid){setError("homeError","Firebase girişini gözlə, sonra yenidən yoxla.");return;}
  setError("homeError","");
  busy=true;
  try{
    let code,exists=true;
    for(let i=0;i<8&&exists;i++){code=code4();const s=await get(roomRef(code));exists=s.exists();}
    if(exists) throw new Error("Unikal otaq kodu yaradıla bilmədi. Yenidən yoxla.");
    const player={name,character:CHARACTERS[Math.floor(Math.random()*CHARACTERS.length)],alive:true,joinedAt:Date.now()};
    await set(roomRef(code),{
      hostId:uid,state:"lobby",createdAt:Date.now(),
      players:{[uid]:player}
    });
    subscribeRoom(code);
  }catch(e){setError("homeError",firebaseMessage(e));}
  finally{busy=false;}
}
async function joinRoom(){
  const name=cleanName($("nickname").value), code=$("roomCodeInput").value.trim().toUpperCase();
  if(!name){setError("homeError","Əvvəlcə oyunçu adını yaz.");return;}
  if(!uid){setError("homeError","Firebase girişini gözlə, sonra yenidən yoxla.");return;}
  if(!/^[A-Z0-9]{4}$/.test(code)){setError("homeError","4 simvollu otaq kodunu düzgün yaz.");return;}
  setError("homeError","");busy=true;
  try{
    const rr=roomRef(code), snap=await get(rr);
    if(!snap.exists()) throw new Error("Bu kodla otaq tapılmadı.");
    const data=snap.val(), players=Object.keys(data.players||{});
    if(data.state!=="lobby") throw new Error("Bu otaqda oyun artıq başlayıb.");
    if(players.length>=10) throw new Error("Otaq doludur (10/10).");
    if(data.players?.[uid]){subscribeRoom(code);return;}
    const character=CHARACTERS.find(c=>!Object.values(data.players||{}).some(p=>p.character===c))||CHARACTERS[0];
    await update(rr,{[`players/${uid}`]:{name,character,alive:true,joinedAt:Date.now()}});
    subscribeRoom(code);
  }catch(e){setError("homeError",firebaseMessage(e));}
  finally{busy=false;}
}
async function changeCharacter(){
  if(!currentRoom||roomData?.state!=="lobby") return;
  const character=$("characterSelect").value;
  try{await update(ref(db,`rooms/${currentRoom}/players/${uid}`),{character});}
  catch(e){toast(firebaseMessage(e));}
}
async function startGame(){
  if(!isHost()||busy)return;
  busy=true;
  try{
    const rr=roomRef(currentRoom);
    const result=await runTransaction(rr,room=>{
      if(!room||room.hostId!==uid||room.state!=="lobby") return;
      const ids=Object.keys(room.players||{});
      if(ids.length<2||ids.length>10)return;
      ids.forEach(id=>room.players[id].alive=true);
      room.state="playing";
      room.game={chamber:0,bulletIndex:Math.floor(Math.random()*6),turnPlayerId:ids[0],log:[logEntry("Oyun başladı. İlk növbə "+room.players[ids[0]].name+" oyunçusundadır.")]};
      return room;
    });
    if(!result.committed) toast("Oyun başlana bilmədi. Ən azı 2 oyunçu olmalıdır.");
  }catch(e){toast(firebaseMessage(e));}
  finally{busy=false;}
}
function nextAliveId(players,currentId){
  const ids=Object.keys(players), start=ids.indexOf(currentId);
  for(let step=1;step<=ids.length;step++){
    const id=ids[(start+step)%ids.length];
    if(players[id]?.alive!==false)return id;
  }
  return null;
}
async function shoot(){
  if(!selectedTarget||busy||!currentTurn())return;
  const targetId=selectedTarget, shooterId=uid;
  busy=true; $("shootButton").disabled=true;
  try{
    const rr=roomRef(currentRoom);
    let outcome=null;
    const result=await runTransaction(rr,room=>{
      if(!room||room.state!=="playing"||room.game?.turnPlayerId!==shooterId)return;
      const shooter=room.players?.[shooterId], target=room.players?.[targetId];
      if(!shooter||shooter.alive===false||!target||target.alive===false)return;
      const g=room.game;
      const hit=g.chamber===g.bulletIndex;
      const targetName=target.character||target.name, shooterName=shooter.character||shooter.name;
      if(hit){
        target.alive=false;
        addLog(room,`${shooterName} atəş açdı. ${targetName} oyundan çıxdı.`);
        outcome={hit:true,targetName,self:targetId===shooterId};
      }else{
        addLog(room,`${shooterName} atəş açdı. Güllə boş çıxdı.`);
        outcome={hit:false,targetName,self:targetId===shooterId};
      }
      g.chamber=(g.chamber+1)%6;
      if(alivePlayers(room).length<=1){
        room.state="ended";
        const winner=alivePlayers(room)[0];
        addLog(room,winner?`${winner.character||winner.name} qalib gəldi.`:"Oyun heç-heçə bitdi.");
        return room;
      }
      if(!hit && targetId===shooterId){
        g.turnPlayerId=shooterId;
        addLog(room,`${shooterName} özünü hədəf aldı, amma boş çıxdı. Növbə onda qalır.`);
      }else{
        g.turnPlayerId=nextAliveId(room.players,shooterId);
      }
      return room;
    });
    if(!result.committed){toast("Atəş açıla bilmədi. Növbəni yoxla.");return;}
    selectedTarget=null;
    if(outcome){
      $("shotResult").textContent=outcome.hit?`GÜLLƏ DƏYDİ — ${outcome.targetName} oyundan çıxdı.`:"BOŞ! Güllə çıxmadı.";
      if(outcome.hit)toast("Atəş dəydi.");
      else toast("Boş çıxdı.");
    }
  }catch(e){toast(firebaseMessage(e));}
  finally{busy=false;if(roomData?.state==="playing")renderGame();}
}
async function leaveRoom(ask=true){
  if(!currentRoom)return;
  const code=currentRoom;
  if(ask&&!confirm("Otaqdan çıxmaq istəyirsən?"))return;
  if(roomUnsub){roomUnsub();roomUnsub=null;}
  try{
    const rr=roomRef(code);
    if(roomData?.state==="lobby"){
      if(isHost()){
        await set(rr,null);
      }else{
        await set(ref(db,`rooms/${code}/players/${uid}`),null);
      }
    }else if(roomData?.state==="playing"&&me()?.alive!==false){
      await runTransaction(rr,room=>{
        if(!room||room.state!=="playing"||!room.players?.[uid])return;
        room.players[uid].alive=false;
        addLog(room,`${room.players[uid].name} otaqdan çıxdı və oyundan kənarlaşdırıldı.`);
        if(alivePlayers(room).length<=1)room.state="ended";
        else if(room.game.turnPlayerId===uid)room.game.turnPlayerId=nextAliveId(room.players,uid);
        return room;
      });
    }
  }catch(e){console.warn(e);}
  currentRoom=null;roomData=null;selectedTarget=null;showScreen("home");
}
function firebaseMessage(e){
  const code=e?.code||"";
  if(code.includes("permission-denied"))return "Firebase icazə vermədi. Realtime Database Rules bölməsini yoxla.";
  if(code.includes("unauthorized-domain"))return "GitHub Pages domeni Firebase Authentication → Authorized domains bölməsinə əlavə edilməlidir.";
  if(code.includes("network"))return "İnternet bağlantısını yoxla.";
  if(code.includes("auth/operation-not-allowed"))return "Firebase-də Anonymous Authentication aktiv deyil.";
  return e?.message||"Naməlum xəta baş verdi.";
}

$("createRoom").addEventListener("click",createRoom);
$("joinRoom").addEventListener("click",joinRoom);
$("characterSelect").innerHTML=CHARACTERS.map(c=>`<option>${escapeHtml(c)}</option>`).join("");
$("characterSelect").addEventListener("change",changeCharacter);
$("startGame").addEventListener("click",startGame);
$("shootButton").addEventListener("click",shoot);
$("leaveLobby").addEventListener("click",()=>leaveRoom());
$("leaveGame").addEventListener("click",()=>leaveRoom());
$("copyCode").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(currentRoom);toast("Otaq kodu kopyalandı.");}
  catch{toast("Otaq kodu: "+currentRoom);}
});
$("backHome").addEventListener("click",()=>{currentRoom=null;roomData=null;showScreen("home");});
$("roomCodeInput").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4));

$("connection").textContent="FIREBASE-Ə QOŞULUR...";
signInAnonymously(auth).catch(e=>{
  $("connection").textContent="GİRİŞ XƏTASI";
  setError("homeError",firebaseMessage(e));
});
onAuthStateChanged(auth,user=>{
  if(user){uid=user.uid;$("connection").textContent="ONLAYN • ANONİM GİRİŞ";}
  else {$("connection").textContent="BAĞLANTI GÖZLƏNİLİR";uid=null;}
});
                                                                                                                                                                              
