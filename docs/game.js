const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'YOUR_ACTUAL_ANON_KEY_HERE'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100;
let interestRate = 0.05;
let userId = null;
let currentUsername = "";
let sceneRef;

async function handleAuth(type) {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    try {
        if (type === 'signup') {
            const { data, error } = await _supabase.auth.signUp({ email, password });
            if (error) throw error;
            userId = data.user.id;
            currentUsername = username;
            await _supabase.from('profiles').insert({ id: userId, username: username, gold: 100 });
            alert("Found Empire Success! Log in now.");
        } else {
            const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            userId = data.user.id;
            document.getElementById('auth-overlay').style.display = 'none';
            document.getElementById('logout-btn').style.display = 'block';
            loadCloudData();
        }
    } catch (err) { alert(err.message); }
}

async function handleLogout() { await _supabase.auth.signOut(); location.reload(); }

function buyItem(type, cost, bonus) {
    if (gold >= cost) {
        gold -= cost;
        interestRate += bonus;
        spawnVisual(type);
        updateUI();
        syncToCloud();
    }
}

function spawnVisual(type) {
    if (!sceneRef) return;
    const emojis = { farm: '🌾', bank: '🏦', tree: '🌳' };
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * (window.innerHeight - 200) + 100;
    sceneRef.add.text(x, y, emojis[type] || '🏠', { fontSize: '32px' });
}

async function loadCloudData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) { gold = data.gold; interestRate = data.interest_rate; currentUsername = data.username; updateUI(); }
    updateLeaderboard();
}

async function syncToCloud() {
    if (!userId) return;
    await _supabase.from('profiles').upsert({ id: userId, gold: gold, interest_rate: interestRate, username: currentUsername, last_save: new Date().toISOString() });
}

async function updateLeaderboard() {
    const { data } = await _supabase.from('leaderboard').select('*');
    if (data) {
        document.getElementById('leaderboard-list').innerHTML = data.map((p, i) => `<div>${i+1}. ${p.username}: ${Math.floor(p.gold)}G</div>`).join('');
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#2d3436',
    scene: { create: function() {
        sceneRef = this;
        this.input.on('pointerdown', () => { if(userId) { gold += 1; updateUI(); } });
    }}
};
new Phaser.Game(config);

function updateUI() {
    document.getElementById('gold-display').innerText = Math.floor(gold);
    document.getElementById('rate-display').innerText = (interestRate * 100).toFixed(0);
}

setInterval(() => { if (userId) { gold += (gold * interestRate); updateUI(); syncToCloud(); } }, 3000);
