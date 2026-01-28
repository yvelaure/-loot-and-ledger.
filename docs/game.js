const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, xp = 0, level = 1, interest = 0.05, userId = null, currentUsername = "", myGuild = "";
let sceneRef, bossSprite = null, bossHealth = 1000, guildGold = 0, isCrashActive = false, crashClicks = 0, lastDaily = 0;
const channel = _supabase.channel('global');

// --- AUTH ---
async function handleAuth(type) {
    const email = document.getElementById('email').value, pass = document.getElementById('pw').value, user = document.getElementById('username').value;
    try {
        const { data, error } = (type === 'signup') ? await _supabase.auth.signUp({email, password:pass}) : await _supabase.auth.signInWithPassword({email, password:pass});
        if (error) throw error;
        userId = data.user.id; currentUsername = user || "Ruler";
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('guild-screen').style.display = 'flex';
        initRealtime(); loadData();
    } catch (e) { alert(e.message); }
}

// --- REALTIME ---
function initRealtime() {
    channel.on('broadcast', { event: 'chat' }, (p) => addMsg(p.payload.user, p.payload.msg))
    .on('broadcast', { event: 'trade' }, (p) => { if(p.payload.to === currentUsername) { gold += p.payload.amt; updateUI(); }})
    .on('broadcast', { event: 'rain' }, (p) => triggerRainEffect())
    .on('broadcast', { event: 'boss_spawn' }, () => spawnBoss())
    .on('broadcast', { event: 'boss_hit' }, (p) => syncBoss(p.payload.hp))
    .on('broadcast', { event: 'guild_raid' }, (p) => {
        if(p.payload.target === myGuild) {
            let loss = Math.floor(guildGold * 0.2); guildGold -= loss;
            addMsg("⚔️ WAR", `${p.payload.attacker} raided us for ${loss}G!`); updateUI();
        }
    })
    .on('broadcast', { event: 'news' }, (p) => { document.getElementById('news-content').innerText = p.payload.text; })
    .subscribe();
}

// --- MECHANICS ---
function buyItem(name, cost, bonus, gain) {
    if (gold >= cost) {
        gold -= cost; interest += bonus; xp += gain;
        sceneRef.add.text(Phaser.Math.Between(100, 700), Phaser.Math.Between(100, 500), (name==='farm'?'🌾':'🏦'), {fontSize:'40px'});
        checkLevel(); updateUI(); saveToCloud();
    }
}

function castGoldRain() {
    if (gold >= 500) { gold -= 500; channel.send({type:'broadcast', event:'rain'}); triggerRainEffect(); }
}

function triggerRainEffect() {
    gold += 50; updateUI();
    for (let i=0; i<10; i++) {
        let c = sceneRef.add.text(Phaser.Math.Between(0, window.innerWidth), -50, '💰', {fontSize:'30px'});
        sceneRef.tweens.add({ targets:c, y:window.innerHeight+50, duration:2000, onComplete:()=>c.destroy()});
    }
}

function claimDaily() {
    const now = Date.now();
    if (now - lastDaily > 86400000) { gold += 250; xp += 50; lastDaily = now; updateUI(); } 
    else { alert("Ready tomorrow!"); }
}

// --- COMBAT & EVENTS ---
function spawnBoss() {
    if (bossSprite) return;
    bossHealth = 1000; document.getElementById('boss-ui').style.display = 'block';
    bossSprite = sceneRef.add.text(window.innerWidth/2, window.innerHeight/2, '🐲', {fontSize:'150px'}).setOrigin(0.5).setInteractive();
    bossSprite.on('pointerdown', () => {
        bossHealth -= 20; channel.send({type:'broadcast', event:'boss_hit', payload:{hp:bossHealth}}); syncBoss(bossHealth);
    });
}

function syncBoss(hp) {
    bossHealth = hp; document.getElementById('boss-fill').style.width = (bossHealth/10) + "%";
    if (bossHealth <= 0 && bossSprite) {
        bossSprite.destroy(); bossSprite = null; document.getElementById('boss-ui').style.display = 'none';
        gold += 1000; xp += 200; updateUI();
    }
}

function startCrash() {
    if (isCrashActive) return;
    isCrashActive = true; crashClicks = 0; document.getElementById('crash-overlay').style.display = 'flex';
    setTimeout(() => {
        if (crashClicks < 15) { gold *= 0.8; addMsg("Market", "Lost 20% Gold!"); }
        isCrashActive = false; document.getElementById('crash-overlay').style.display = 'none'; updateUI();
    }, 5000);
}

// --- UTILS ---
function checkLevel() {
    let n = level * 100; if (xp >= n) { xp -= n; level++; updateUI(); }
}

function updateUI() {
    document.getElementById('gold').innerText = Math.floor(gold);
    document.getElementById('lvl').innerText = level;
    document.getElementById('xp-fill').style.width = (xp / (level * 100) * 100) + "%";
    document.getElementById('bank-btn').disabled = (level < 2);
    document.getElementById('guild-bank').innerText = Math.floor(guildGold);
    document.getElementById('raid-btn').style.display = (guildGold >= 1000) ? 'block' : 'none';
}

function addMsg(u, m) {
    const b = document.getElementById('messages');
    b.innerHTML += `<div><b>${u}:</b> ${m}</div>`; b.scrollTop = b.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value) {
        const val = e.target.value;
        if(val.startsWith('/trade')) {
            const p = val.split(' ');
            if(gold >= p[2]) { gold -= p[2]; channel.send({type:'broadcast', event:'trade', payload:{to:p[1], amt:parseInt(p[2])}}); }
        } else {
            channel.send({type:'broadcast', event:'chat', payload:{user:currentUsername, msg:val}}); addMsg("You", val);
        }
        e.target.value = "";
    }
});

// --- ENGINE & PERSISTENCE ---
const config = {
    type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight,
    scene: { create: function() { 
        sceneRef = this; 
        this.input.on('pointerdown', (p) => {
            if(isCrashActive) { crashClicks++; document.getElementById('crash-clicks-ui').innerText = `Clicks: ${15-crashClicks}`; }
            else if(userId && p.y > 150) { gold += 1; updateUI(); }
        });
    }}
};
// --- Updated Phaser Section in game.js ---
const config = {
    type: Phaser.AUTO, 
    parent: 'game-container', 
    width: window.innerWidth, 
    height: window.innerHeight,
    scene: { 
        create: function() { 
            sceneRef = this; 
            
            // Interaction logic
            this.input.on('pointerdown', (p) => {
                if(isCrashActive) { 
                    crashClicks++; 
                    document.getElementById('crash-clicks-ui').innerText = `Clicks: ${15-crashClicks}`; 
                }
                else if(userId && p.y > 150) { gold += 1; updateUI(); }
            });

            // --- DAY / NIGHT CYCLE ---
            let isNight = false;
            setInterval(() => {
                isNight = !isNight;
                
                // Change Phaser Background
                // Sky Blue: 0x87ceeb | Deep Night: 0x1a1a2e
                const targetColor = isNight ? 0x1a1a2e : 0x87ceeb;
                this.cameras.main.setBackgroundColor(targetColor);
                
                // Change HTML Body (for UI background)
                document.body.style.backgroundColor = isNight ? "#1a1a2e" : "#87ceeb";
                
                // Optional: Broadcast it to the News Ticker
                const timeMsg = isNight ? "🌙 Night falls over the empire..." : "☀️ A new day begins!";
                document.getElementById('news-content').innerText = `📣 ${timeMsg}`;
            }, 60000); // Swaps every 60 seconds

        }
    }
};
// --- Updated Phaser Section in game.js ---
const config = {
    type: Phaser.AUTO, 
    parent: 'game-container', 
    width: window.innerWidth, 
    height: window.innerHeight,
    scene: { 
        create: function() { 
            sceneRef = this; 
            
            // Interaction logic
            this.input.on('pointerdown', (p) => {
                if(isCrashActive) { 
                    crashClicks++; 
                    document.getElementById('crash-clicks-ui').innerText = `Clicks: ${15-crashClicks}`; 
                }
                else if(userId && p.y > 150) { gold += 1; updateUI(); }
            });

            // --- DAY / NIGHT CYCLE ---
            let isNight = false;
            setInterval(() => {
                isNight = !isNight;
                
                // Change Phaser Background
                // Sky Blue: 0x87ceeb | Deep Night: 0x1a1a2e
                const targetColor = isNight ? 0x1a1a2e : 0x87ceeb;
                this.cameras.main.setBackgroundColor(targetColor);
                
                // Change HTML Body (for UI background)
                document.body.style.backgroundColor = isNight ? "#1a1a2e" : "#87ceeb";
                
                // Optional: Broadcast it to the News Ticker
                const timeMsg = isNight ? "🌙 Night falls over the empire..." : "☀️ A new day begins!";
                document.getElementById('news-content').innerText = `📣 ${timeMsg}`;
            }, 60000); // Swaps every 60 seconds

        }
    }
};

