const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, level = 1, interest = 0.05, userId = null, currentUsername = "";
let buildings = [], isDemolishMode = false, sceneRef = null, bossKills = 0;
let remotePlayers = {}, crashActive = false, crashClicks = 0;
const channel = _supabase.channel('global', { config: { presence: { key: currentUsername } } });

// --- MULTIPLAYER CORE ---
async function startGuestGame() {
    const name = document.getElementById('username').value.trim();
    if (!name) return;
    currentUsername = name;
    userId = name.toLowerCase().replace(/\s/g, '_');
    document.getElementById('auth-screen').style.display = 'none';

    // Set up Real-time Listeners
    channel.on('broadcast', { event: 'chat' }, (p) => addMsg(p.payload.user, p.payload.msg))
           .on('broadcast', { event: 'trade' }, (p) => {
               if(p.payload.to === currentUsername) {
                   gold += parseInt(p.payload.amt); updateUI();
                   addMsg("SYSTEM", `Received ${p.payload.amt}G from ${p.payload.from}`);
               }
           })
           .on('presence', { event: 'sync' }, () => updateRemotePlayers(channel.presenceState()))
           .subscribe(async (status) => {
               if (status === 'SUBSCRIBED') {
                   await channel.track({ username: currentUsername, x: Math.random()*400+50, y: 150 });
               }
           });
    loadData();
}

function updateRemotePlayers(state) {
    if(!sceneRef) return;
    Object.values(remotePlayers).forEach(p => p.destroy());
    remotePlayers = {};
    Object.keys(state).forEach(id => {
        const user = state[id][0];
        if (user.username !== currentUsername) {
            remotePlayers[id] = sceneRef.add.text(user.x, user.y, `👑\n${user.username}`, {
                fontSize: '14px', align: 'center', fill: '#ffd700'
            }).setOrigin(0.5);
        }
    });
}

// --- SURVIVAL & BUILDING ---
function buyItem(name, cost, b) {
    if (gold >= cost && !isDemolishMode) {
        gold -= cost; interest += b;
        const x = Math.random() * (window.innerWidth - 80) + 40;
        const y = Math.random() * (window.innerHeight * 0.3) + (window.innerHeight * 0.3);
        const icon = (name === 'farm') ? '🌾' : '🏦';
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
                interest -= (icon === '🌾' ? 0.01 : 0.08);
                gold += (icon === '🌾' ? 25 : 250);
                b.destroy(); updateUI(); saveToCloud();
            }
        }
    });
}

function spawnBarbarian() {
    if(!sceneRef || buildings.length === 0) return;
    document.getElementById('defense-msg').style.display = 'block';
    const x = Math.random() > 0.5 ? -50 : window.innerWidth + 50;
    const enemy = sceneRef.add.text(x, Math.random()*window.innerHeight, '⚔️', { fontSize: '45px' }).setOrigin(0.5).setInteractive();
    const target = buildings[Math.floor(Math.random() * buildings.length)];
    
    sceneRef.tweens.add({
        targets: enemy, x: target.x, y: target.y, duration: 7000,
        onComplete: () => {
            if(enemy.active) {
                const idx = buildings.findIndex(b => b.x === target.x && b.y === target.y);
                if(idx > -1) { buildings.splice(idx, 1); sceneRef.scene.restart(); }
                enemy.destroy(); document.getElementById('defense-msg').style.display = 'none';
            }
        }
    });

    enemy.on('pointerdown', () => {
        enemy.destroy(); bossKills++; gold += 20; updateUI(); saveToCloud();
        document.getElementById('defense-msg').style.display = 'none';
        addMsg("BATTLE", "Raider defeated!");
    });
}

// --- ENGINE & EVENTS ---
const config = {
    type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight, transparent: true,
    scene: {
        create: function() { 
            sceneRef = this; 
            // Clouds
            for(let i=0; i<4; i++) {
                let c = this.add.text(-100, Math.random()*200, '☁️', {fontSize:'50px'}).setAlpha(0.1);
                this.tweens.add({targets:c, x:window.innerWidth+100, duration: 40000+(i*5000), repeat:-1});
            }
            this.input.on('pointerdown', (p) => {
                if(crashActive) { crashClicks++; return; }
                if(userId && p.y < window.innerHeight * 0.6 && !isDemolishMode) {
                    gold += 1; updateUI();
                    let t = this.add.text(p.x, p.y, "+1", {color: '#ffd700', fontSize: '20px'});
                    this.tweens.add({targets: t, y: p.y - 60, alpha: 0, duration: 600, onComplete: () => t.destroy()});
                }
            });
        }
    }
};
new Phaser.Game(config);

function updateUI() {
    document.getElementById('gold').innerText = Math.floor(gold).toLocaleString();
    document.getElementById('lvl').innerText = level;
    document.getElementById('stat-kills').innerText = bossKills;
    document.getElementById('b-total').innerText = buildings.length;
}

async function saveToCloud() {
    if(!userId) return;
    await _supabase.from('profiles').upsert({ id: userId, username: currentUsername, gold, interest_rate: interest, buildings: JSON.stringify(buildings), level, boss_kills: bossKills });
}

async function loadData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if(data) {
        gold = data.gold; level = data.level; bossKills = data.boss_kills || 0;
        if(data.buildings) { JSON.parse(data.buildings).forEach(b => { buildings.push(b); placeBuildingSprite(b.x, b.y, b.icon); }); }
        updateUI();
    }
}

// Chat & Trading
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && e.target.value) {
        const val = e.target.value;
        if(val.startsWith('/trade')) {
            const p = val.split(' ');
            channel.send({type:'broadcast', event:'trade', payload:{from:currentUsername, to:p[1], amt:p[2]}});
        } else {
            channel.send({type:'broadcast', event:'chat', payload:{user:currentUsername, msg:val}});
            addMsg("You", val);
        }
        e.target.value = "";
    }
});

function addMsg(u, m) { const b = document.getElementById('messages'); b.innerHTML += `<div><b>${u}:</b> ${m}</div>`; b.scrollTop = 9999; }
function toggleDemolish() { isDemolishMode = !isDemolishMode; }

// TIMERS
setInterval(() => { if(userId) { gold += (gold * interest); updateUI(); }}, 10000); // Income
setInterval(() => { if(userId && buildings.length > 0) spawnBarbarian(); }, 40000); // Raids
