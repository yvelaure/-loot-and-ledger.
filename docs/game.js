const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, xp = 0, level = 1, interest = 0.05, userId = null, currentUsername = "";
let buildings = [], isDemolishMode = false, sceneRef = null;
const channel = _supabase.channel('global');

// --- AUTH: BYPASSING EMAIL LIMITS ---
async function startGuestGame() {
    const name = document.getElementById('username').value.trim();
    if (!name) return alert("Enter a name!");
    
    currentUsername = name;
    // Uses the name as a unique ID to avoid Auth email limits
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
        
        // Ensure buildings spawn in visible area
        const x = Math.random() * (window.innerWidth - 100) + 50;
        const y = Math.random() * (window.innerHeight * 0.3) + (window.innerHeight * 0.25);
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

function toggleDemolish() {
    isDemolishMode = !isDemolishMode;
    document.getElementById('demolish-btn').innerText = isDemolishMode ? "🛑 STOP" : "🔨 Demolish: OFF";
    document.getElementById('demolish-btn').style.background = isDemolishMode ? "#ff9f43" : "#ff4757";
}

function updateUI() {
    document.getElementById('gold').innerText = Math.floor(gold).toLocaleString();
    document.getElementById('lvl').innerText = level;
    document.getElementById('b-total').innerText = buildings.length;
}

// --- ENGINE ---
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    transparent: true,
    scene: {
        create: function() { 
            sceneRef = this; 
            this.input.on('pointerdown', (p) => {
                // Clicking sky gives gold
                if(userId && p.y < window.innerHeight * 0.6 && !isDemolishMode) {
                    gold += 1;
                    updateUI();
                    let t = this.add.text(p.x, p.y, "+1", {color: '#ffd700', fontSize: '20px'});
                    this.tweens.add({targets: t, y: p.y - 60, alpha: 0, duration: 600, onComplete: () => t.destroy()});
                }
            });
        }
    }
};
new Phaser.Game(config);

async function saveToCloud() {
    if(!userId) return;
    await _supabase.from('profiles').upsert({ 
        id: userId, username: currentUsername, gold: gold, interest_rate: interest, 
        buildings: JSON.stringify(buildings), level: level 
    });
}

async function loadData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if(data) {
        gold = data.gold; interest = data.interest_rate; level = data.level;
        if(data.buildings) {
            buildings = JSON.parse(data.buildings);
            buildings.forEach(b => placeBuildingSprite(b.x, b.y, b.icon));
        }
        updateUI();
    }
}

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

setInterval(() => { if(userId) { gold += (gold * interest); updateUI(); }}, 10000);
