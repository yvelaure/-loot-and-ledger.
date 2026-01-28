const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, xp = 0, level = 1, interest = 0.05, userId = null, currentUsername = "";
let buildings = [], isDemolishMode = false, sceneRef = null, bossKills = 0;
const channel = _supabase.channel('global');

// --- AUTH: BYPASS EMAIL LIMITS ---
async function startGuestGame() {
    const name = document.getElementById('username').value.trim();
    if (!name) return alert("Enter a name!");
    currentUsername = name;
    userId = name.toLowerCase().replace(/\s/g, '_');
    document.getElementById('auth-screen').style.display = 'none';
    initRealtime();
    loadData();
}

function initRealtime() {
    channel.on('broadcast', { event: 'chat' }, (p) => addMsg(p.payload.user, p.payload.msg)).subscribe();
}

// --- BUILDING SYSTEM ---
function buyItem(name, cost, b, g) {
    if (gold >= cost && !isDemolishMode) {
        gold -= cost; interest += b; xp += g;
        const x = Math.random() * (window.innerWidth - 100) + 50;
        const y = Math.random() * (window.innerHeight * 0.3) + (window.innerHeight * 0.3);
        const icon = (name === 'farm') ? '🌾' : '🏦';
        placeBuildingSprite(x, y, icon);
        buildings.push({ x, y, icon });
        updateUI();
        saveToCloud();
    }
}

function placeBuildingSprite(x, y, icon) {
    if(!sceneRef) return;
    const b = sceneRef.add.text(x, y, icon, { fontSize: '42px' }).setOrigin(0.5).setInteractive();
    b.on('pointerdown', () => {
        if (isDemolishMode) {
            const idx = buildings.findIndex(item => item.x === x && item.y === y);
            if (idx > -1) buildings.splice(idx, 1);
            interest -= (icon === '🌾' ? 0.01 : 0.08);
            gold += (icon === '🌾' ? 25 : 250);
            b.destroy();
            updateUI();
            saveToCloud();
        }
    });
}

// --- BARBARIAN RAIDS ---
function spawnBarbarian() {
    if(!sceneRef || buildings.length === 0) return;

    document.body.classList.add('raid-active');
    document.getElementById('defense-msg').style.display = 'block';

    const x = Math.random() > 0.5 ? -50 : window.innerWidth + 50;
    const y = Math.random() * window.innerHeight;
    const enemy = sceneRef.add.text(x, y, '⚔️', { fontSize: '45px' }).setOrigin(0.5).setInteractive();
    
    const target = buildings[Math.floor(Math.random() * buildings.length)];
    
    sceneRef.tweens.add({
        targets: enemy,
        x: target.x, y: target.y,
        duration: 8000 - (level * 150),
        onComplete: () => {
            if(enemy.active) {
                removeBuilding(target);
                enemy.destroy();
                stopRaidFX();
            }
        }
    });

    enemy.on('pointerdown', () => {
        enemy.destroy();
        bossKills++; // Fixed Kill Counter
        gold += 25;
        updateUI();
        stopRaidFX();
        addMsg("BATTLE", "Raider slain! +25G");
        saveToCloud();
    });
}

function removeBuilding(target) {
    const idx = buildings.findIndex(b => b.x === target.x && b.y === target.y);
    if(idx > -1) {
        buildings.splice(idx, 1);
        interest -= (target.icon === '🌾' ? 0.01 : 0.08);
        addMsg("LOSS", "Your structure was pillaged!");
        sceneRef.scene.restart(); // Refreshes the view
    }
}

function stopRaidFX() {
    document.body.classList.remove('raid-active');
    document.getElementById('defense-msg').style.display = 'none';
}

// --- ENGINE & VISUALS ---
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    transparent: true,
    scene: {
        create: function() { 
            sceneRef = this; 
            // Animated Clouds for Depth
            for(let i=0; i<5; i++) {
                let c = this.add.text(Math.random()*innerWidth, Math.random()*innerHeight*0.3, '☁️', {fontSize:'60px'}).setAlpha(0.15);
                this.tweens.add({targets:c, x:innerWidth+100, duration:30000+(Math.random()*20000), repeat:-1, onRepeat:()=>c.x=-100});
            }
            this.input.on('pointerdown', (p) => {
                if(userId && p.y < window.innerHeight * 0.6 && !isDemolishMode) {
                    gold += 1; updateUI();
                    let t = this.add.text(p.x, p.y, "+1", {color: '#ffd700', fontSize: '24px', fontStyle:'bold'});
                    this.tweens.add({targets: t, y: p.y - 80, alpha: 0, duration: 600, onComplete: () => t.destroy()});
                }
            });
        }
    }
};
new Phaser.Game(config);

function updateUI() {
    document.getElementById('gold').innerText = Math.floor(gold).toLocaleString();
    document.getElementById('lvl').innerText = level;
    document.getElementById('stat-kills').innerText = bossKills; // Syncs with screenshot HUD
    document.getElementById('b-total').innerText = buildings.length;
}

async function saveToCloud() {
    if(!userId) return;
    await _supabase.from('profiles').upsert({ 
        id: userId, username: currentUsername, gold, interest_rate: interest, 
        buildings: JSON.stringify(buildings), level, boss_kills: bossKills 
    });
}

async function loadData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if(data) {
        gold = data.gold; interest = data.interest_rate; level = data.level; bossKills = data.boss_kills || 0;
        if(data.buildings) {
            buildings = JSON.parse(data.buildings);
            buildings.forEach(b => placeBuildingSprite(b.x, b.y, b.icon));
        }
        updateUI();
    }
}

function toggleDemolish() {
    isDemolishMode = !isDemolishMode;
    document.getElementById('demolish-btn').innerText = isDemolishMode ? "🛑 STOP" : "🔨 Demolish: OFF";
}

function claimDaily() { gold += 100; addMsg("DAILY", "+100G Gift!"); updateUI(); }

function addMsg(u, m) {
    const box = document.getElementById('messages');
    box.innerHTML += `<div><b style="color:var(--gold)">${u}:</b> ${m}</div>`;
    box.scrollTop = box.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && e.target.value) {
        channel.send({type:'broadcast', event:'chat', payload:{user:currentUsername, msg:e.target.value}});
        addMsg("You", e.target.value);
        e.target.value = "";
    }
});

// Passive Income & Random Raider Spawns
setInterval(() => { if(userId) { gold += (gold * interest); updateUI(); }}, 10000);
setInterval(() => { if(userId && buildings.length > 0 && Math.random() > 0.7) spawnBarbarian(); }, 30000);
