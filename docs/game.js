// Ensure Supabase is connected first
const supabaseUrl = 'https://xcauvxurhusnaaucqooo.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYXV2eHVyaHVzbmFhdWNxb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxNjQsImV4cCI6MjA4NTE3OTE2NH0._NyUcjTgy8YmB-YLpGq4lyT15_UihKuSkOmI78ADIys'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Core Game Variables
let gold = 100, multiplier = 1, interest = 0.01, userId = null;
let sceneRef = null;

// Audio setup (optional, but makes clicks feel real)
const coinSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2006/2006-preview.mp3');

async function startGuestGame() {
    const name = document.getElementById('username').value.trim();
    if (!name) return alert("Sign the ledger, Ruler!");
    userId = name.toLowerCase().replace(/\s/g, '_');
    document.getElementById('auth-screen').style.display = 'none';
    
    // Connect to Supabase to load progress
    loadData();
}

// 1. THE CLICK ENGINE
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    transparent: true, // This allows the wood background to show through
    scene: {
        create: function() {
            sceneRef = this;
            
            // This captures clicks on the empty space (the desk)
            this.input.on('pointerdown', (pointer) => {
                if(!userId) return;
                
                // Add Gold
                gold += multiplier;
                updateUI();
                
                // Play Sound
                coinSound.cloneNode().play();
                
                // Visual Feedback (Floating Text)
                let t = this.add.text(pointer.x, pointer.y, `+${multiplier}`, { 
                    fontFamily: 'MedievalSharp', 
                    fontSize: '24px', 
                    color: '#D4AF37' 
                });
                this.tweens.add({
                    targets: t,
                    y: pointer.y - 100,
                    alpha: 0,
                    duration: 800,
                    onComplete: () => t.destroy()
                });
            });
        }
    }
};

new Phaser.Game(config);

// 2. THE PURCHASE ENGINE
function buyItem(name, cost) {
    if (gold >= cost) {
        gold -= cost;
        if (name === 'farm') interest += 0.02;
        if (name === 'tower') multiplier += 1; // Example upgrade
        
        updateUI();
        saveToCloud();
        
        // Spawn a visual item on the desk
        sceneRef.add.text(Math.random()*innerWidth, Math.random()*innerHeight, 
            name === 'farm' ? '🌾' : '🏹', { fontSize: '42px' });
    } else {
        alert("Your treasury is too low!");
    }
}

function updateUI() {
    // This updates the actual text on your screen
    const goldDisplay = document.getElementById('gold');
    if(goldDisplay) goldDisplay.innerText = Math.floor(gold).toLocaleString();
}

// 3. PERSISTENCE (Cloud Saving)
async function saveToCloud() {
    if(userId) await _supabase.from('profiles').upsert({ id: userId, gold, multiplier });
}

async function loadData() {
    const { data } = await _supabase.from('profiles').select('*').eq('id', userId).single();
    if(data) {
        gold = data.gold;
        multiplier = data.multiplier || 1;
        updateUI();
    }
}

// Passive Income (Every 5 seconds)
setInterval(() => {
    if(userId) {
        gold += (gold * interest);
        updateUI();
    }
}, 5000);
