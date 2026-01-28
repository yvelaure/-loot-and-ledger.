const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, xp = 0, level = 1, interest = 0.05, userId = null, currentUsername = "";
let buildings = [], bossKills = 0, crashSaves = 0, lastRank = 99, isDemolishMode = false;
let sceneRef = null, bossSprite = null, bossHealth = 1000, isCrashActive = false, crashClicks = 0;
const channel = _supabase.channel('global');

// --- AUTH ---
async function handleAuth(type) {
    const email = document.getElementById('email').value, pass = document.getElementById('pw').value, user = document.getElementById('username').value;
    try {
        const { data, error } = (type === 'signup') ? await _supabase.auth.signUp({email, password:pass}) : await _supabase.auth.signInWithPassword({email, password:pass});
        if (error) throw error;
        userId = data.user.id; currentUsername = user || "Ruler";
        document.getElementById('auth-screen').style.display = 'none';
        initRealtime(); loadData();
        setTimeout(() => { if(!localStorage.getItem('tutorialDone')) document.getElementById('tutorial-overlay').style.display='flex'; }, 1000);
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

// --- GAME LOGIC ---
function buyItem(name, cost, b, g) {
    if (gold >= cost && !isDemolishMode) {
        gold -= cost; interest += b; xp += g;
        document.getElementById('build-sound').play().catch(()=>{});
        const x = Math.random() * (window.innerWidth - 60) + 30;
        const y = Math.random() * (window.innerHeight / 3) + (window.innerHeight / 1.8);
        const icon = (name === 'farm') ? '🌾' : '🏦';
        placeBuildingSprite(x, y, icon);
        buildings.push({ x, y, icon });
        updateUI(); saveToCloud();
    }
}

function placeBuildingSprite(x, y, icon) {
    if(!sceneRef) return;
    const bSprite = sceneRef.add.text(x, y, icon, { fontSize: '32px' }).setOrigin(0.5).setInteractive();
    bSprite.setScale(0);
    sceneRef.tweens.add({ targets: bSprite, scale: 1, duration: 400, ease: 'Back.easeOut' });

    bSprite.on('pointerdown', () => {
        if (isDemolishMode) {
            const index = buildings.findIndex(b => b.x === x && b.y === y);
            if (index > -1) buildings.splice(index, 1);
            interest -= (icon === '🌾') ? 0.01 : 0.08;
            gold += (icon === '🌾') ? 25 : 250;
            bSprite.destroy();
            updateUI(); saveToCloud();
        }
    });
}

function toggleDemolish() {
    isDemolishMode = !isDemolishMode;
    document.body.classList.toggle('demolish-active', isDemolishMode);
    document.getElementById('demolish-btn').innerText = isDemolishMode ? "🛑 STOP" : "🔨 Demolish: OFF";
}

function claimDaily() {
    gold += 250; xp += 50; updateUI(); addMsg("System", "Claimed 250G Bonus!");
}

function updateUI() {
    document.getElementById('gold').innerText = Math.floor(gold).toLocaleString();
    document.getElementById('lvl').innerText = level;
    document.getElementById('stat-kills').innerText = bossKills;
    document.getElementById('b-total').innerText = buildings.length;
    document.getElementById('xp-fill').style.width = (xp / (level * 100) * 100) + "%";
    if(xp >= level * 100) { xp = 0; level++; addMsg("LEVEL UP", `Rank ${level} achieved!`); }
}

// --- WORLD EVENTS ---
function spawnBoss() {
    if (bossSprite) return;
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
        gold += 1000; bossKills++; updateUI();
    }
}

function startCrash() {
    if (isCrashActive) return;
    isCrashActive = true; crashClicks = 0; document.getElementById('crash-overlay').style.display = 'flex';
    document.getElementById('siren-sound').play().catch(()=>{});
    document.body.classList.add('shake-active');
    setTimeout(() => {
        document.body.classList.remove('shake-active'); document.getElementById('siren-sound').pause();
        if (crashClicks < 15) { gold *= 0.8; addMsg("CRASH", "Market collapse! Lost 20% gold."); } 
        else { crashSaves++; addMsg("CRASH", "Crisis averted!"); }
        isCrashActive = false; document.getElementById('crash-overlay').style.display = 'none'; updateUI();
    }, 5000);
}

// --- LEADERBOARD & RANK ---
async function toggleLeaderboard() {
    const o = document.getElementById('leaderboard-overlay');
    o.style.display = (o.style.display === 'none') ? 'flex' : 'none';
    if(o.style.display === 'flex') {
        const { data } = await _supabase.from('profiles').select('username, gold, level').order('gold', { ascending: false }).limit(10);
        document.getElementById('leaderboard-list').innerHTML = data.map((p,i)=>`<div style="padding:5px; border-bottom:1px solid #333;">${i+1}. ${p.username} - ${Math.floor(p.gold)}G</div>`).join('');
    }
}

function triggerNewsFlash(text) {
    const ticker = document.getElementById('news-ticker'), content = document.getElementById('news-content');
    content.innerText = text; ticker.classList.add('announcement-flash'); setTimeout(()=>ticker.classList.remove('announcement-flash'), 5000);
}

// --- ENGINE ---
const config = {
    type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight,
    scene: { create: function() { 
        sceneRef = this; 
        this.input.on('pointerdown', (p) => {
            if(isCrashActive) crashClicks++;
            else if(userId && p.y > 150 && !isDemolishMode) { gold += 1; updateUI(); }
        });
        setInterval(() => { this.cameras.main.setBackgroundColor(Math.random() > 0.5 ? 0x1a1a2e : 0x87ceeb); }, 60000);
    }}
};
new Phaser.Game(config);

async function saveToCloud() {
    if(userId) await _supabase.from('profiles').upsert({ id:userId, gold, xp, level, interest_rate:interest, buildings: JSON.stringify(buildings), boss_kills:bossKills, username:currentUsername });
    const t = document.getElementById('save-toast'); t.style.display='block'; setTimeout(()=>t.style.display='none',1000);
}

async function loadData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if(data) {
        gold = data.gold; xp = data.xp; level = data.level; interest = data.interest_rate; bossKills = data.boss_kills || 0;
        if(data.buildings) { buildings = JSON.parse(data.buildings); buildings.forEach(b => placeBuildingSprite(b.x, b.y, b.icon)); }
        updateUI();
    }
}

function closeTutorial() { document.getElementById('tutorial-overlay').style.display='none'; localStorage.setItem('tutorialDone', 'true'); }
function addMsg(u, m) { document.getElementById('messages').innerHTML += `<div><b>[${u}]</b> ${m}</div>`; document.getElementById('messages').scrollTop = 9999; }

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value) {
        if(e.target.value.startsWith('/trade')) {
            const p = e.target.value.split(' ');
            if(gold >= p[2]) { gold -= p[2]; channel.send({type:'broadcast', event:'trade', payload:{from:currentUsername, to:p[1], amt:p[2]}}); addMsg("You", `Sent ${p[2]}G to ${p[1]}`); updateUI(); }
        } else {
            channel.send({type:'broadcast', event:'chat', payload:{user:currentUsername, msg:e.target.value}});
            addMsg("You", e.target.value);
        }
        e.target.value = "";
    }
});

// --- TIMERS ---
setInterval(() => { if(userId) { gold += (gold * interest); updateUI(); }}, 10000);
setInterval(() => { if(userId) saveToCloud(); }, 30000);
setInterval(() => { if(userId && Math.random() > 0.8) startCrash(); }, 180000);
setInterval(() => { if(userId && !bossSprite) { spawnBoss(); channel.send({type:'broadcast', event:'boss_spawn'}); }}, 600000);
