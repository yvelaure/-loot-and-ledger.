// --- 1. CONFIG & DB ---
const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, interestRate = 0.05, userId = null, currentUsername = "", myGuild = "";
let sceneRef, bossSprite = null, bossHealth = 1000, guildGold = 0, isCrashActive = false, crashClicks = 0;
const channel = _supabase.channel('global-sync');

// --- 2. AUTH & GUILD JOIN ---
async function handleAuth(type) {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    try {
        const { data, error } = (type === 'signup') ? 
            await _supabase.auth.signUp({ email, password }) : 
            await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        userId = data.user.id;
        currentUsername = username || "Ruler";
        if (type === 'signup') await _supabase.from('profiles').insert({ id: userId, username: currentUsername, gold: 100 });
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('guild-overlay').style.display = 'flex';
        initRealtime();
        loadCloudData();
    } catch (e) { alert(e.message); }
}

function joinGuild() {
    const name = document.getElementById('guild-name-input').value;
    if (name) {
        myGuild = name;
        document.getElementById('guild-overlay').style.display = 'none';
        document.getElementById('guild-panel').style.display = 'block';
        document.getElementById('guild-name-display').innerText = myGuild;
        addChatMessage("System", `Joined Guild [${myGuild}]`);
    }
}

// --- 3. REALTIME SYNC ---
function initRealtime() {
    channel
    .on('broadcast', { event: 'chat' }, (p) => addChatMessage(p.payload.user, p.payload.msg))
    .on('broadcast', { event: 'rain' }, (p) => triggerRain(p.payload.user))
    .on('broadcast', { event: 'guild_bank' }, (p) => { if(p.payload.guild === myGuild) { guildGold += p.payload.amount; updateUI(); }})
    .on('broadcast', { event: 'guild_raid' }, (p) => {
        if(p.payload.target === myGuild) {
            let loss = Math.floor(guildGold * 0.2);
            guildGold -= loss;
            addChatMessage("⚔️ WAR", `${p.payload.attacker} stole ${loss}G from our bank!`);
            updateUI();
        }
    })
    .on('broadcast', { event: 'boss_spawn' }, () => spawnBoss())
    .on('broadcast', { event: 'boss_hit' }, (p) => syncBoss(p.payload.hp))
    .subscribe();
}

// --- 4. GAMEPLAY MECHANICS ---
function buyItem(type, cost, bonus) {
    if (gold >= cost) {
        gold -= cost; interestRate += bonus;
        sceneRef.add.text(Math.random()*window.innerWidth, Math.random()*window.innerHeight+200, type==='farm'?'🌾':'🏦', {fontSize:'40px'});
        updateUI(); syncToCloud();
    }
}

function castGoldRain() {
    if (gold >= 500) {
        gold -= 500;
        channel.send({ type:'broadcast', event:'rain', payload:{ user:currentUsername }});
        triggerRain("You");
    }
}

function triggerRain(sender) {
    gold += 50; updateUI();
    for (let i=0; i<15; i++) {
        const coin = sceneRef.add.text(Math.random()*window.innerWidth, -50, '💰', {fontSize:'30px'});
        sceneRef.tweens.add({ targets:coin, y:window.innerHeight+50, duration:2000, onComplete:()=>coin.destroy()});
    }
}

function triggerWar() {
    const target = prompt("Target Guild Name:");
    if(target && target !== myGuild) {
        channel.send({ type:'broadcast', event:'guild_raid', payload:{ attacker:myGuild, target:target }});
        addChatMessage("⚔️ ATTACK", `Raid launched against ${target}!`);
    }
}

// --- 5. BOSS & CRASH SYSTEMS ---
function spawnBoss() {
    if (bossSprite) return;
    bossHealth = 1000;
    document.getElementById('boss-ui').style.display = 'block';
    bossSprite = sceneRef.add.text(window.innerWidth/2, window.innerHeight/2, '🐲', {fontSize:'160px'}).setOrigin(0.5).setInteractive();
    bossSprite.on('pointerdown', () => {
        bossHealth -= 20;
        channel.send({ type:'broadcast', event:'boss_hit', payload:{ hp: bossHealth }});
        syncBoss(bossHealth);
    });
}

function syncBoss(hp) {
    bossHealth = hp;
    document.getElementById('boss-fill').style.width = (bossHealth/10) + "%";
    if (bossHealth <= 0 && bossSprite) {
        bossSprite.destroy(); bossSprite = null;
        document.getElementById('boss-ui').style.display = 'none';
        gold += 1000; updateUI();
    }
}

function startCrash() {
    if (isCrashActive) return;
    isCrashActive = true; crashClicks = 0;
    document.getElementById('crash-overlay').style.display = 'flex';
    setTimeout(() => {
        if (crashClicks < 15) { gold = Math.floor(gold * 0.8); addChatMessage("Market", "Lost 20% gold in crash!"); }
        isCrashActive = false; document.getElementById('crash-overlay').style.display = 'none';
        updateUI();
    }, 5000);
}

// --- 6. PHASER & UI ---
const config = {
    type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight,
    scene: { create: function() { 
        sceneRef = this;
        this.input.on('pointerdown', (p) => {
            if (!userId) return;
            if (isCrashActive) { crashClicks++; document.getElementById('crash-clicks-ui').innerText = `Clicks: ${15-crashClicks}`; }
            else if (p.y > 150) { gold += 1; updateUI(); }
        });
        // Day/Night Cycle
        let night = false;
        setInterval(() => {
            night = !night;
            this.cameras.main.setBackgroundColor(night ? 0x1a1a2e : 0x87ceeb);
            document.body.style.backgroundColor = night ? "#1a1a2e" : "#87ceeb";
        }, 60000);
    }}
};
new Phaser.Game(config);

function updateUI() {
    document.getElementById('gold-display').innerText = Math.floor(gold);
    document.getElementById('rate-display').innerText = (interestRate * 100).toFixed(0);
    document.getElementById('guild-bank').innerText = Math.floor(guildGold);
    document.getElementById('raid-btn').style.display = (guildGold >= 1000) ? 'block' : 'none';
    if(gold >= 10000) document.getElementById('achievement-box').style.display = 'block';
}

function addChatMessage(user, msg) {
    const box = document.getElementById('chat-messages');
    box.innerHTML += `<div><b>${user}:</b> ${msg}</div>`;
    box.scrollTop = box.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value) {
        channel.send({ type:'broadcast', event:'chat', payload:{ user:currentUsername, msg:e.target.value }});
        addChatMessage("You", e.target.value);
        e.target.value = "";
    }
});

// --- 7. CLOUD SYNC LOOPS ---
async function loadCloudData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) { gold = data.gold; interestRate = data.interest_rate; updateUI(); }
}

async function syncToCloud() {
    if (userId) await _supabase.from('profiles').upsert({ id:userId, gold:gold, interest_rate:interestRate, username:currentUsername });
}

async function updateLeaderboard() {
    const { data } = await _supabase.from('leaderboard').select('*');
    if (data) document.getElementById('leaderboard-list').innerHTML = data.map((p,i)=>`<div>${i+1}. ${p.username}: ${Math.floor(p.gold)}G</div>`).join('');
}

setInterval(() => { if(userId) { gold += (gold * interestRate); updateUI(); syncToCloud(); updateLeaderboard(); } }, 5000);
setInterval(() => { if(userId && Math.random() > 0.8) startCrash(); }, 180000);
setInterval(() => { if(userId && !bossSprite) { spawnBoss(); channel.send({type:'broadcast', event:'boss_spawn'}); }}, 900000);

function donateToGuild() { if(gold >= 100) { gold -= 100; channel.send({type:'broadcast', event:'guild_bank', payload:{guild:myGuild, amount:100}}); updateUI(); }}
