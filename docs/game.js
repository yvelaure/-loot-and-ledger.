const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, multiplier = 1, kills = 0, interest = 0.05, userId = null, currentUsername = "";
let buildings = [], towerCount = 0, sceneRef = null, taxTime = 60;
const coinSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2006/2006-preview.mp3');
const channel = _supabase.channel('global');

let quests = [
    { id: 'q1', text: "Build 5 Farms", goal: 5, current: 0, reward: 500, type: 'farm', done: false },
    { id: 'q2', text: "Slay 10 Raiders", goal: 10, current: 0, reward: 1500, type: 'kill', done: false }
];

async function startGuestGame() {
    const name = document.getElementById('username').value.trim();
    if (!name) return;
    currentUsername = name;
    userId = name.toLowerCase().replace(/\s/g, '_');
    document.getElementById('auth-screen').style.display = 'none';
    
    channel.on('broadcast', { event: 'trade' }, (p) => renderTrade(p.payload)).subscribe();
    loadData(); renderQuests(); fetchLeaderboard();
}

async function fetchLeaderboard() {
    const { data } = await _supabase.from('profiles').select('id, gold').order('gold', { ascending: false }).limit(5);
    if (data) {
        document.getElementById('leader-list').innerHTML = data.map((p, i) => `
            <div class="rank-row"><span>${i+1}. ${p.id}</span><span>${Math.floor(p.gold)}G</span></div>
        `).join('');
    }
}

function buyItem(name, cost) {
    if (gold >= cost) {
        gold -= cost; coinSound.play();
        if(name === 'tower') towerCount++;
        else interest += (name === 'farm' ? 0.01 : 0.08);
        const icon = name === 'farm' ? '🌾' : '🏹';
        sceneRef.add.text(Math.random()*innerWidth*0.6, Math.random()*innerHeight*0.3+250, icon, {fontSize:'40px'});
        if(name === 'farm') checkQuests('farm');
        updateUI(); saveToCloud();
    }
}

function checkQuests(type) {
    quests.forEach(q => {
        if(!q.done && q.type === type) {
            q.current++;
            if(q.current >= q.goal) { q.done = true; gold += q.reward; }
        }
    });
    renderQuests();
}

function renderQuests() {
    document.getElementById('q-list').innerHTML = quests.map(q => `<div style="${q.done?'text-decoration:line-through;opacity:0.4':''}">${q.text} (${q.current}/${q.goal})</div>`).join('');
}

function startHaggle() {
    const win = Math.random() > 0.5;
    gold = Math.floor(gold * (win ? 1.15 : 0.85));
    coinSound.play(); updateUI();
}

function postTrade() {
    if(gold >= 100) {
        gold -= 100;
        channel.send({ type: 'broadcast', event: 'trade', payload: { seller: currentUsername, price: 150 }});
        updateUI();
    }
}

function renderTrade(d) {
    const list = document.getElementById('market-list');
    list.innerHTML += `<div class="rank-row"><span>${d.seller}</span><button onclick="buyTrade(${d.price})">${d.price}G</button></div>`;
}

function buyTrade(p) { if(gold >= p) { gold -= p; gold += (p * 1.5); updateUI(); coinSound.play(); } }

function spawnRaider() {
    if(!sceneRef) return;
    if(towerCount > 0 && Math.random() < 0.3) { kills++; checkQuests('kill'); return; }
    document.getElementById('defense-alert').style.display = 'block';
    const raider = sceneRef.add.text(Math.random()*innerWidth, -50, '⚔️', { fontSize: '40px' }).setInteractive();
    sceneRef.tweens.add({ targets: raider, y: 400, duration: 4000, onComplete: () => {
        if(raider.active) { gold *= 0.8; raider.destroy(); document.getElementById('defense-alert').style.display = 'none'; updateUI(); }
    }});
    raider.on('pointerdown', () => { raider.destroy(); kills++; checkQuests('kill'); updateUI(); document.getElementById('defense-alert').style.display = 'none'; });
}

const config = {
    type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight, transparent: true,
    scene: { create: function() { 
        sceneRef = this;
        this.input.on('pointerdown', (p) => {
            if(!userId) return;
            gold += multiplier; updateUI(); coinSound.cloneNode().play();
            let t = this.add.text(p.x, p.y, `+${multiplier}`, {color: '#D4AF37', fontStyle: 'bold'});
            this.tweens.add({targets: t, y: p.y - 60, alpha: 0, duration: 600, onComplete: () => t.destroy()});
        });
    }}
};
new Phaser.Game(config);

setInterval(() => {
    if(!userId) return;
    taxTime--; document.getElementById('tax-clock').innerText = taxTime;
    if(taxTime <= 0) { gold *= 0.9; taxTime = 60; updateUI(); saveToCloud(); }
}, 1000);

function updateUI() { 
    document.getElementById('gold').innerText = Math.floor(gold).toLocaleString(); 
    document.getElementById('kills').innerText = kills;
}
async function saveToCloud() { if(userId) await _supabase.from('profiles').upsert({ id: userId, gold, multiplier }); }
async function loadData() { 
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single(); 
    if(data) { gold = data.gold; multiplier = data.multiplier || 1; updateUI(); } 
}
setInterval(fetchLeaderboard, 30000);
setInterval(() => { if(userId) spawnRaider(); }, 40000);
