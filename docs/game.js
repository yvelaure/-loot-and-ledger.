const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, xp = 0, level = 1, interest = 0.05, userId = null, currentUsername = "";
let bossKills = 0, crashSaves = 0, lastRank = 99, sceneRef = null, bossSprite = null, bossHealth = 1000;
let isCrashActive = false, crashClicks = 0, lastDaily = 0;
const channel = _supabase.channel('global');

// --- AUTH & INITIALIZATION ---
async function handleAuth(type) {
    const email = document.getElementById('email').value, pass = document.getElementById('pw').value, user = document.getElementById('username').value;
    try {
        const { data, error } = (type === 'signup') ? await _supabase.auth.signUp({email, password:pass}) : await _supabase.auth.signInWithPassword({email, password:pass});
        if (error) throw error;
        userId = data.user.id; currentUsername = user || "Ruler";
        if (type === 'signup') localStorage.removeItem('tutorialCompleted');
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('guild-screen').style.display = 'flex';
        initRealtime(); loadData();
    } catch (e) { alert(e.message); }
}

function initRealtime() {
    channel.on('broadcast', { event: 'chat' }, (p) => addMsg(p.payload.user, p.payload.msg))
    .on('broadcast', { event: 'trade' }, (p) => { if(p.payload.to.toLowerCase() === currentUsername.toLowerCase()) { gold += parseInt(p.payload.amt); updateUI(); addMsg("TRADE", `Received ${p.payload.amt}G from ${p.payload.from}`); }})
    .on('broadcast', { event: 'boss_spawn' }, () => spawnBoss())
    .on('broadcast', { event: 'boss_hit' }, (p) => syncBoss(p.payload.hp))
    .on('broadcast', { event: 'news' }, (p) => triggerNewsFlash(p.payload.text))
    .subscribe();
}

// --- CORE LOOPS ---
function updateUI() {
    document.getElementById('gold').innerText = Math.floor(gold).toLocaleString();
    document.getElementById('lvl').innerText = level;
    document.getElementById('xp-fill').style.width = (xp / (level * 100) * 100) + "%";
    document.getElementById('bank-btn').disabled = (level < 2);
    document.getElementById('stat-kills').innerText = bossKills;
    document.getElementById('stat-saves').innerText = crashSaves;
    let n = level * 100; if(xp >= n) { xp -= n; level++; addMsg("Level Up", `You are now Level ${level}!`); }
}

function buyItem(name, cost, b, g) {
    if (gold >= cost) { gold -= cost; interest += b; xp += g; if(sceneRef) sceneRef.add.text(Math.random()*600, Math.random()*400+100, (name==='farm'?'🌾':'🏦'), {fontSize:'40px'}); updateUI(); saveToCloud(); }
}

function claimDaily() {
    const now = Date.now();
    if (now - lastDaily > 86400000) { gold += 250; xp += 50; lastDaily = now; updateUI(); addMsg("System", "250G Daily Bonus Claimed!"); }
    else alert("Daily bonus resets every 24 hours.");
}

// --- WORLD EVENTS ---
function spawnBoss() {
    if (bossSprite || !sceneRef) return;
    bossHealth = 1000; document.getElementById('boss-ui').style.display = 'block';
    document.getElementById('boss-music').play().catch(()=>{});
    bossSprite = sceneRef.add.text(window.innerWidth/2, window.innerHeight/2, '🐲', {fontSize:'140px'}).setOrigin(0.5).setInteractive();
    bossSprite.on('pointerdown', () => { bossHealth -= 20; channel.send({type:'broadcast', event:'boss_hit', payload:{hp:bossHealth}}); syncBoss(bossHealth); });
}

function syncBoss(hp) {
    bossHealth = hp; document.getElementById('boss-fill').style.width = (bossHealth/10) + "%";
    if (bossHealth <= 0 && bossSprite) {
        bossSprite.destroy(); bossSprite = null; document.getElementById('boss-ui').style.display = 'none';
        document.getElementById('boss-music').pause(); document.getElementById('victory-sound').play().catch(()=>{});
        gold += 1000; bossKills++; updateUI(); addMsg("VICTORY", "Dragon Slain! +1000 Gold!");
    }
}

function startCrash() {
    if (isCrashActive) return;
    isCrashActive = true; crashClicks = 0; document.getElementById('crash-overlay').style.display = 'flex';
    document.body.classList.add('shake-active'); document.getElementById('siren-sound').play().catch(()=>{});
    setTimeout(() => {
        document.body.classList.remove('shake-active'); document.getElementById('siren-sound').pause();
        if (crashClicks < 15) { gold *= 0.8; addMsg("MARKET", "Economic Crash! Lost 20% gold."); } 
        else { crashSaves++; addMsg("MARKET", "Safe! Treasury protected."); }
        isCrashActive = false; document.getElementById('crash-overlay').style.display = 'none'; updateUI();
    }, 5000);
}

// --- LEADERBOARD & ASCENSION ---
async function toggleLeaderboard() {
    const o = document.getElementById('leaderboard-overlay');
    o.style.display = (o.style.display === 'none') ? 'flex' : 'none';
    if(o.style.display === 'flex') {
        const { data } = await _supabase.from('profiles').select('username, gold, level').order('gold', { ascending: false }).limit(10);
        document.getElementById('leaderboard-list').innerHTML = data.map((p,i)=>`<div style="padding:8px; border-bottom:1px solid #333;">${i+1}. <b>${p.username}</b> - ${Math.floor(p.gold).toLocaleString()}G (Lvl ${p.level})</div>`).join('');
    }
}

async function checkRank() {
    const { data } = await _supabase.from('profiles').select('id').order('gold', { ascending: false }).limit(3);
    const myRank = data.findIndex(p => p.id === userId) + 1;
    if (myRank > 0 && myRank < lastRank) {
        const msg = `🏆 ASCENSION: ${currentUsername} just hit Rank #${myRank} in the World!`;
        channel.send({type:'broadcast', event:'news', payload:{text: msg}});
    }
    lastRank = (myRank === 0) ? 99 : myRank;
}

function triggerNewsFlash(text) {
    const t = document.getElementById('news-ticker'), c = document.getElementById('news-content');
    c.innerText = text; t.classList.add('announcement-flash'); setTimeout(()=>t.classList.remove('announcement-flash'), 5000);
}

// --- ENGINE ---
const config = {
    type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight,
    scene: { create: function() { 
        sceneRef = this; 
        this.input.on('pointerdown', (p) => {
            if(isCrashActive) { crashClicks++; document.getElementById('crash-clicks-ui').innerText = `TAP! ${15-crashClicks} left`; }
            else if(userId && p.y > 150) { gold += 1; updateUI(); }
        });
        let isNight = true; 
        setInterval(() => { isNight = !isNight; this.cameras.main.setBackgroundColor(isNight ? 0x1a1a2e : 0x87ceeb); document.body.style.backgroundColor = isNight ? "#1a1a2e" : "#87ceeb"; }, 60000);
    }}
};
new Phaser.Game(config);

async function saveToCloud() {
    if(userId) await _supabase.from('profiles').upsert({ id:userId, gold, xp, level, interest_rate:interest, boss_kills:bossKills, crash_saves:crashSaves, username:currentUsername });
    const t = document.getElementById('save-toast'); t.style.display='block'; setTimeout(()=>t.style.display='none',1000);
}

async function loadData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if(data) { gold = data.gold; xp = data.xp; level = data.level; interest = data.interest_rate; bossKills = data.boss_kills || 0; crashSaves = data.crash_saves || 0; updateUI(); }
}

function joinGuild() { document.getElementById('guild-screen').style.display = 'none'; setTimeout(() => { if(!localStorage.getItem('tutorialCompleted')) document.getElementById('tutorial-overlay').style.display='flex'; }, 800); }
function closeTutorial() { document.getElementById('tutorial-overlay').style.display='none'; localStorage.setItem('tutorialCompleted','true'); }

function addMsg(u, m) { const b = document.getElementById('messages'); b.innerHTML += `<div><span style="color:var(--gold)">[${u}]</span> ${m}</div>`; b.scrollTop = b.scrollHeight; }

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value) {
        const val = e.target.value;
        if (val.startsWith('/trade')) {
            const parts = val.split(' ');
            if (gold >= parseInt(parts[2])) {
                gold -= parseInt(parts[2]); updateUI();
                channel.send({type:'broadcast', event:'trade', payload:{from:currentUsername, to:parts[1], amt:parts[2]}});
                addMsg("SYSTEM", `Sent ${parts[2]}G to ${parts[1]}`);
            }
        } else {
            channel.send({type:'broadcast', event:'chat', payload:{user:currentUsername, msg:val}});
            addMsg("You", val);
        }
        e.target.value = "";
    }
});

// --- TIMERS ---
setInterval(() => { if(userId) { gold += (gold * interest); updateUI(); }}, 10000);
setInterval(() => { if(userId) { saveToCloud(); checkRank(); }}, 30000);
setInterval(() => { if(userId && Math.random() > 0.8) startCrash(); }, 180000);
setInterval(() => { if(userId && !bossSprite) { spawnBoss(); channel.send({type:'broadcast', event:'boss_spawn'}); }}, 600000);
