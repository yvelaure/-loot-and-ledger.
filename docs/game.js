const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100, multiplier = 1, interest = 0.02, userId = null, taxTime = 60, sceneRef = null;
const coinSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2006/2006-preview.mp3');

async function startGuestGame() {
    const name = document.getElementById('username').value.trim();
    if (!name) return;
    userId = name.toLowerCase().replace(/\s/g, '_');
    document.getElementById('auth-screen').style.display = 'none';
    loadData(); fetchLeaderboard();
}

const config = {
    type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight, transparent: true,
    scene: {
        create: function() {
            sceneRef = this;
            this.input.on('pointerdown', (p) => {
                if(!userId) return;
                gold += multiplier; updateUI(); coinSound.cloneNode().play().catch(()=>{});
                let t = this.add.text(p.x, p.y, `+${multiplier}`, {fontFamily:'MedievalSharp', fontSize:'24px', color:'#D4AF37'});
                this.tweens.add({targets:t, y:p.y-80, alpha:0, duration:600, onComplete:()=>t.destroy()});
            });
        }
    }
};
new Phaser.Game(config);

window.buyItem = function(name, cost) {
    if (gold >= cost) {
        gold -= cost;
        if(name === 'farm') interest += 0.03; else multiplier += 2;
        sceneRef.add.text(Math.random()*innerWidth, Math.random()*innerHeight, name==='farm'?'🌾':'🏹', {fontSize:'40px'}).setAlpha(0.7);
        updateUI(); saveToCloud();
    }
};

window.startHaggle = function() {
    gold = Math.random() > 0.5 ? Math.floor(gold * 1.15) : Math.floor(gold * 0.85);
    updateUI();
};

function updateUI() { document.getElementById('gold').innerText = Math.floor(gold).toLocaleString(); }
async function saveToCloud() { if(userId) await _supabase.from('profiles').upsert({ id: userId, gold, multiplier }); }
async function loadData() { const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single(); if(data) { gold = data.gold; multiplier = data.multiplier || 1; updateUI(); } }
async function fetchLeaderboard() {
    const { data } = await _supabase.from('profiles').select('id, gold').order('gold', { ascending: false }).limit(5);
    if (data) document.getElementById('leader-list').innerHTML = data.map((p, i) => `<div style="display:flex; justify-content:space-between; font-size:12px;"><span>${i+1}. ${p.id}</span><span>${Math.floor(p.gold)}G</span></div>`).join('');
}

setInterval(() => {
    if(!userId) return; taxTime--; document.getElementById('tax-clock').innerText = taxTime;
    if(taxTime <= 0) { gold *= 0.9; taxTime = 60; updateUI(); saveToCloud(); }
}, 1000);
