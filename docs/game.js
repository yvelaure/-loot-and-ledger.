const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, multiplier = 1, bossKills = 0, interest = 0.05, userId = null, currentUsername = "";
let buildings = [], towerCount = 0, sceneRef = null, haggleActive = false, bossHealth = 1000;
let remotePlayers = {};
let quests = [
    { id: 'q1', text: "Establish 5 Farms", goal: 5, current: 0, reward: 500, type: 'farm', done: false },
    { id: 'q2', text: "Slay 10 Raiders", goal: 10, current: 0, reward: 1500, type: 'kill', done: false },
    { id: 'q3', text: "Treasury of 5000G", goal: 5000, current: 0, reward: 2000, type: 'gold', done: false }
];

const channel = _supabase.channel('global', { config: { presence: { key: 'user' } } });

async function startGuestGame() {
    const name = document.getElementById('username').value.trim();
    if (!name) return;
    currentUsername = name;
    userId = name.toLowerCase().replace(/\s/g, '_');
    document.getElementById('auth-screen').style.display = 'none';

    channel.on('broadcast', { event: 'chat' }, (p) => addMsg(p.payload.user, p.payload.msg))
           .on('presence', { event: 'sync' }, () => updatePresence(channel.presenceState()))
           .subscribe(async (s) => { if(s==='SUBSCRIBED') await channel.track({ name: name, x: Math.random()*300+50, y: 150 }); });

    loadData();
    renderQuests();
}

function updatePresence(state) {
    if(!sceneRef) return;
    Object.values(remotePlayers).forEach(p => p.destroy());
    Object.keys(state).forEach(id => {
        const u = state[id][0];
        if(u.name !== currentUsername) {
            remotePlayers[id] = sceneRef.add.text(u.x, u.y, `👑\n${u.name}`, { fontSize: '14px', align: 'center', fill: '#ffd700' }).setOrigin(0.5);
        }
    });
}

function buyItem(name, cost) {
    if (gold >= cost) {
        gold -= cost;
        if(name === 'tower') towerCount++;
        else interest += (name === 'farm' ? 0.01 : 0.08) * multiplier;
        const icon = name === 'farm' ? '🌾' : name === 'bank' ? '🏦' : '🏹';
        const x = Math.random() * (window.innerWidth - 100) + 50;
        const y = Math.random() * (window.innerHeight * 0.4) + 200;
        sceneRef.add.text(x, y, icon, { fontSize: '42px' }).setOrigin(0.5);
        buildings.push({ x, y, icon });
        if(name === 'farm') checkQuests('farm');
        updateUI(); saveToCloud();
    }
}

function checkQuests(type, amt = 1) {
    quests.forEach(q => {
        if(!q.done && (q.type === type || (q.type === 'gold' && gold >= q.goal))) {
            if(q.type === 'gold') q.current = gold; else q.current += amt;
            if(q.current >= q.goal) { q.done = true; gold += q.reward; addMsg("QUEST", `Finished: ${q.text}!`); }
        }
    });
    renderQuests();
}

function renderQuests() {
    document.getElementById('q-list').innerHTML = quests.map(q => `<div class="quest-item ${q.done ? 'quest-done' : ''}">${q.text} (${Math.min(q.current, q.goal)}/${q.goal})</div>`).join('');
}

function spawnBarbarian() {
    if(!sceneRef || buildings.length === 0) return;
    if(towerCount > 0 && Math.random() < 0.25) { bossKills++; checkQuests('kill'); addMsg("TOWER", "Raider Slayed!"); return; }
    document.getElementById('defense-alert').style.display = 'block';
    const enemy = sceneRef.add.text(Math.random()*innerWidth, -50, '⚔️', { fontSize: '40px' }).setInteractive();
    const target = buildings[Math.floor(Math.random()*buildings.length)];
    sceneRef.tweens.add({ targets: enemy, x: target.x, y: target.y, duration: 6000, onComplete: () => {
        if(enemy.active) { buildings = buildings.filter(b => b.x !== target.x); sceneRef.scene.restart(); document.getElementById('defense-alert').style.display = 'none'; }
    }});
    enemy.on('pointerdown', () => { enemy.destroy(); bossKills++; checkQuests('kill'); gold += 25 * multiplier; updateUI(); document.getElementById('defense-alert').style.display = 'none'; });
}

function spawnBoss() {
    if(!sceneRef) return;
    bossHealth = 1000; document.getElementById('boss-ui').style.display = 'block';
    const boss = sceneRef.add.text(innerWidth/2, innerHeight/2, '🐲', {fontSize: '80px'}).setOrigin(0.5).setInteractive();
    boss.on('pointerdown', () => {
        bossHealth -= 50; document.getElementById('boss-fill').style.width = (bossHealth/10) + "%";
        if(bossHealth <= 0) { boss.destroy(); gold += 2000; document.getElementById('boss-ui').style.display = 'none'; updateUI(); }
    });
}

function startHaggle() { haggleActive = true; document.getElementById('haggle-overlay').style.display = 'flex'; setTimeout(() => { if(haggleActive) { gold *= 0.9; endHaggle(); } }, 3500); }
function resolveHaggle() { if(haggleActive) { gold += Math.floor(gold*0.25); endHaggle(); } }
function endHaggle() { haggleActive = false; document.getElementById('haggle-overlay').style.display = 'none'; updateUI(); }

const config = {
    type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight, transparent: true,
    scene: { create: function() { 
        sceneRef = this; 
        this.input.on('pointerdown', (p) => {
            if(!userId) return;
            gold += (1 * multiplier); updateUI(); checkQuests('gold');
            let t = this.add.text(p.x, p.y, `+${multiplier}`, {color: '#8b0000', fontStyle: 'bold'});
            this.tweens.add({targets: t, y: p.y - 60, alpha: 0, duration: 800, onComplete: () => t.destroy()});
        });
    }}
};
new Phaser.Game(config);

function prestige() {
    if(gold >= 10000) { multiplier *= 2; gold = 100; buildings = []; towerCount = 0; quests.forEach(q => { q.done = false; q.current = 0; }); sceneRef.scene.restart(); updateUI(); }
}

function updateUI() {
    document.getElementById('gold').innerText = Math.floor(gold).toLocaleString();
    document.getElementById('kills').innerText = bossKills;
    document.getElementById('multi').innerText = multiplier;
    document.getElementById('prestige-box').style.display = gold >= 10000 ? 'block' : 'none';
}

async function saveToCloud() { if(userId) await _supabase.from('profiles').upsert({ id: userId, gold, multiplier, boss_kills: bossKills }); }
async function loadData() { const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single(); if(data) { gold = data.gold; multiplier = data.multiplier || 1; bossKills = data.boss_kills || 0; updateUI(); } }

function addMsg(u, m) { const b = document.getElementById('messages'); b.innerHTML += `<div><b>[${u}]:</b> ${m}</div>`; b.scrollTop = 9999; }
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && e.target.value) { channel.send({type:'broadcast', event:'chat', payload:{user:currentUsername, msg:e.target.value}}); addMsg("You", e.target.value); e.target.value = ""; }
});

setInterval(() => { if(userId) { gold += (gold * interest); updateUI(); checkQuests('gold'); }}, 10000);
setInterval(() => { if(userId && buildings.length > 0) spawnBarbarian(); }, 40000);
setInterval(() => { if(userId && Math.random() > 0.8) startHaggle(); }, 60000);
setInterval(() => { if(userId && Math.random() > 0.9) spawnBoss(); }, 120000);
