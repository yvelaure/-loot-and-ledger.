const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, level = 1, interest = 0.05, userId = null, currentUsername = "";
let buildings = [], isDemolishMode = false, sceneRef = null, bossKills = 0;
let remotePlayers = {}, crashActive = false, crashClicks = 0;
let multiplier = 1, towerCount = 0, bossHealth = 1000;
const channel = _supabase.channel('global', { config: { presence: { key: currentUsername } } });

// --- MULTIPLAYER & AUTH ---
async function startGuestGame() {
    const name = document.getElementById('username').value.trim();
    if (!name) return;
    currentUsername = name;
    document.getElementById('realm-display').innerText = name;
    userId = name.toLowerCase().replace(/\s/g, '_');
    document.getElementById('auth-screen').style.display = 'none';

    channel.on('broadcast', { event: 'chat' }, (p) => addMsg(p.payload.user, p.payload.msg))
           .on('broadcast', { event: 'trade' }, (p) => {
               if(p.payload.to === currentUsername) { gold += parseInt(p.payload.amt); updateUI(); addMsg("SYSTEM", `Recv ${p.payload.amt}G from ${p.payload.from}`); }
           })
           .on('presence', { event: 'sync' }, () => updateRemotePlayers(channel.presenceState()))
           .subscribe(async (s) => { if (s === 'SUBSCRIBED') await channel.track({ username: currentUsername, x: Math.random()*300+50, y: 150 }); });
    loadData();
}

function updateRemotePlayers(state) {
    if(!sceneRef) return;
    Object.values(remotePlayers).forEach(p => p.destroy());
    remotePlayers = {};
    Object.keys(state).forEach(id => {
        const user = state[id][0];
        if (user.username !== currentUsername) {
            remotePlayers[id] = sceneRef.add.text(user.x, user.y, `👑\n${user.username}`, { fontSize: '14px', align: 'center', fill: '#ffd700' }).setOrigin(0.5);
        }
    });
}

// --- BUILDING & DEFENSE ---
function buyItem(name, cost, b) {
    if (gold >= cost && !isDemolishMode) {
        gold -= cost;
        if(name === 'tower') towerCount++;
        else interest += (b * multiplier);
        
        const x = Math.random() * (window.innerWidth - 80) + 40;
        const y = Math.random() * (window.innerHeight * 0.3) + (window.innerHeight * 0.3);
        const icon = name === 'farm' ? '🌾' : name === 'bank' ? '🏦' : '🏹';
        placeBuildingSprite(x, y, icon);
        buildings.push({ x, y, icon });
        updateUI(); saveToCloud();
    }
}

function placeBuildingSprite(x, y, icon) {
    if(!sceneRef) return;
    const b = sceneRef.add.text(x, y, icon, { fontSize: '42px' }).setOrigin(0.5).setInteractive();
    b.on('pointerdown', () => {
        if (isDemolishMode) {
            const idx = buildings.findIndex(item => item.x === x && item.y === y);
            if (idx > -1) {
                buildings.splice(idx, 1);
                if(icon === '🏹') towerCount--; else interest -= (icon === '🌾' ? 0.01 : 0.08) * multiplier;
                gold += (icon === '🌾' ? 25 : 250);
                b.destroy(); updateUI(); saveToCloud();
            }
        }
    });
}

// --- SURVIVAL EVENTS ---
function spawnBarbarian() {
    if(!sceneRef || buildings.length === 0) return;
    if(towerCount > 0 && Math.random() < (0.2 * towerCount)) { bossKills++; updateUI(); addMsg("TOWER", "Raider intercepted!"); return; }

    document.getElementById('defense-msg').style.display = 'block';
    const enemy = sceneRef.add.text(Math.random()*innerWidth, -50, '⚔️', { fontSize: '45px' }).setOrigin(0.5).setInteractive();
    const target = buildings[Math.floor(Math.random() * buildings.length)];
    
    sceneRef.tweens.add({
        targets: enemy, x: target.x, y: target.y, duration: 6000,
        onComplete: () => {
            if(enemy.active) {
                buildings = buildings.filter(b => b.x !== target.x);
                sceneRef.scene.restart(); // Refreshes village
                enemy.destroy(); document.getElementById('defense-msg').style.display = 'none';
                addMsg("LOSS", "A raider destroyed your structure!");
            }
        }
    });
    enemy.on('pointerdown', () => { enemy.destroy(); bossKills++; gold += (25 * multiplier); updateUI(); stopRaid(); });
}

function stopRaid() { document.getElementById('defense-msg').style.display = 'none'; }

function spawnBoss() {
    if(!sceneRef) return;
    bossHealth = 1000; document.getElementById('boss-ui').style.display = 'block';
    const boss = sceneRef.add.text(innerWidth/2, innerHeight/2, '🐲', {fontSize: '100px'}).setOrigin(0.5).setInteractive();
    boss.on('pointerdown', () => {
        bossHealth -= 50; document.getElementById('boss-fill').style.width = (bossHealth/10) + "%";
        if(bossHealth <= 0) { boss.destroy(); gold += 1000; bossKills += 10; document.getElementById('boss-ui').style.display = 'none'; updateUI(); saveToCloud(); }
    });
}

// --- PRESTIGE & ENGINE ---
function prestige() {
    if(gold >= 10000 && confirm("Reset everything for 2x Multiplier?")) {
        multiplier *= 2; gold = 100; buildings = []; towerCount = 0; interest = 0.05;
        sceneRef.scene.restart(); updateUI(); saveToCloud();
    }
}

const config = {
    type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight, transparent: true,
    scene: { create: function() { 
        sceneRef = this; 
        this.input.on('pointerdown', (p) => {
            if(crashActive) { crashClicks++; return; }
            if(userId && p.y < window.innerHeight * 0.6 && !isDemolishMode) {
                gold += (1 * multiplier); updateUI();
                let t = this.add.text(p.x, p.y, `+${multiplier}`, {color: '#ffd700', fontSize: '24px'});
                this.tweens.add({targets: t, y: p.y - 80, alpha: 0, duration: 600, onComplete: () => t.destroy()});
            }
        });
    }}
};
new Phaser.Game(config);

function updateUI() {
    document.getElementById('gold').innerText = Math.floor(gold).toLocaleString();
    document.getElementById('stat-kills').innerText = bossKills;
    document.getElementById('multiplier').innerText = multiplier;
    document.getElementById('b-total').innerText = buildings.length;
    document.getElementById('prestige-btn').style.display = gold >= 10000 ? 'block' : 'none';
}

async function saveToCloud() {
    if(!userId) return;
    await _supabase.from('profiles').upsert({ id: userId, gold, multiplier, buildings: JSON.stringify(buildings), boss_kills: bossKills });
}

async function loadData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if(data) {
        gold = data.gold; multiplier = data.multiplier || 1; bossKills = data.boss_kills || 0;
        if(data.buildings) JSON.parse(data.buildings).forEach(b => { buildings.push(b); placeBuildingSprite(b.x, b.y, b.icon); if(b.icon === '🏹') towerCount++; });
        updateUI();
    }
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && e.target.value) {
        if(e.target.value.startsWith('/trade')) {
            const p = e.target.value.split(' ');
            channel.send({type:'broadcast', event:'trade', payload:{from:currentUsername, to:p[1], amt:p[2]}});
        } else {
            channel.send({type:'broadcast', event:'chat', payload:{user:currentUsername, msg:e.target.value}});
            addMsg("You", e.target.value);
        }
        e.target.value = "";
    }
});

function addMsg(u, m) { const b = document.getElementById('messages'); b.innerHTML += `<div><b>${u}:</b> ${m}</div>`; b.scrollTop = 9999; }
function toggleDemolish() { isDemolishMode = !isDemolishMode; }

setInterval(() => { if(userId) { gold += (gold * interest); updateUI(); }}, 10000);
setInterval(() => { if(userId && buildings.length > 0) spawnBarbarian(); }, 35000);
setInterval(() => { if(userId && Math.random() > 0.9) spawnBoss(); }, 180000);
