const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co';
const supabaseKey = 'YOUR_PUBLIC_ANON_KEY'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let gold = 100;
let interestRate = 0.05;
let userId = null;
let currentUsername = "";

// --- AUTH & SESSION ---
async function handleAuth(type) {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;

    if (type === 'signup') {
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) return alert(error.message);
        userId = data.user.id;
        currentUsername = username;
        await _supabase.from('profiles').insert({ id: userId, username: username, gold: 100 });
        alert("Account created! Verify your email.");
    } else {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) return alert(error.message);
        userId = data.user.id;
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'block';
        loadCloudData();
    }
}

async function handleLogout() {
    await _supabase.auth.signOut();
    location.reload(); // Refresh the page to show the login screen
}

// --- CLOUD SYNC ---
async function loadCloudData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
        gold = data.gold;
        interestRate = data.interest_rate;
        currentUsername = data.username;
        updateUI();
    }
}

async function syncToCloud() {
    if (!userId) return;
    await _supabase.from('profiles').upsert({ 
        id: userId, 
        gold: gold, 
        interest_rate: interestRate,
        username: currentUsername,
        last_save: new Date().toISOString()
    });
}

// --- MARKETPLACE LOGIC ---
function buyItem(name, cost, bonus) {
    if (gold >= cost) {
        gold -= cost;
        interestRate += bonus;
        updateUI();
        syncToCloud();
        alert(`Building built! Your interest increased by ${bonus * 100}%`);
    } else {
        alert("Not enough gold in the treasury!");
    }
}

// --- PHASER ENGINE ---
const config = { type: Phaser.AUTO, parent: 'game-container', width: window.innerWidth, height: window.innerHeight, backgroundColor: '#2d3436', scene: { create: create } };
const game = new Phaser.Game(config);

function create() {
    setInterval(() => {
        if (userId) {
            gold += (gold * interestRate);
            updateUI();
            syncToCloud();
        }
    }, 3000);
}

function updateUI() {
    document.getElementById('gold-display').innerText = Math.floor(gold);
    document.getElementById('rate-display').innerText = (interestRate * 100).toFixed(0);
}
