// --- 1. CONFIGURATION & DATA ---
let gold = parseFloat(localStorage.getItem('L&L_Gold')) || 100;
let interestRate = parseFloat(localStorage.getItem('L&L_Rate')) || 0.05;
let milestoneReached = localStorage.getItem('L&L_Milestone') === 'true';

const events = [
    { name: "Market Boom", effect: 0.02, msg: "Trade is up! Interest +2%" },
    { name: "Tax Increase", effect: -0.01, msg: "New laws! Interest -1%" },
    { name: "Good Harvest", effect: 0.03, msg: "Farms are thriving! Interest +3%" },
    { name: "Bank Panic", effect: -0.04, msg: "Market dip! Interest -4%" }
];

// --- 2. PHASER GAME WORLD ---
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#2d3436',
    scene: { create: create }
};

const game = new Phaser.Game(config);

function create() {
    this.add.text(window.innerWidth/2, window.innerHeight/2, '📦 Village View Under Construction', { fontSize: '20px', alpha: 0.5 }).setOrigin(0.5);
    
    // Start the economy loops
    setInterval(updateEconomy, 3000); // Earn money every 3s
    setInterval(triggerRandomEvent, 20000); // Event every 20s
}

// --- 3. ECONOMY LOGIC ---
function updateEconomy() {
    gold += (gold * interestRate);
    saveAndRefresh();

    // Check for Milestone
    if (gold >= 1000 && !milestoneReached) {
        document.getElementById('milestone-screen').style.display = 'flex';
    }
}

function triggerRandomEvent() {
    const event = events[Math.floor(Math.random() * events.length)];
    interestRate += event.effect;
    if (interestRate < 0.01) interestRate = 0.01; // Minimum 1%
    
    const log = document.getElementById('event-log');
    log.innerHTML = `<strong>${event.name}:</strong> ${event.msg}`;
    setTimeout(() => { log.innerHTML = "Village is stable..."; }, 7000);
    saveAndRefresh();
}

// --- 4. BUTTON ACTIONS ---
document.getElementById('buy-farm').addEventListener('click', () => {
    if (gold >= 50) {
        gold -= 50;
        interestRate += 0.01;
        saveAndRefresh();
    } else {
        alert("Not enough gold!");
    }
});

document.getElementById('share-btn').addEventListener('click', async () => {
    try {
        await navigator.share({
            title: 'Loot & Ledger',
            text: `I'm a Junior Treasurer with ${Math.floor(gold)} gold! Can you beat my economy?`,
            url: window.location.href
        });
    } catch (err) {
        alert("Link copied: " + window.location.href);
    }
});

function closeMilestone() {
    milestoneReached = true;
    localStorage.setItem('L&L_Milestone', 'true');
    document.getElementById('milestone-screen').style.display = 'none';
}

function saveAndRefresh() {
    localStorage.setItem('L&L_Gold', gold);
    localStorage.setItem('L&L_Rate', interestRate);
    document.getElementById('gold-display').innerText = Math.floor(gold);
    document.getElementById('rate-display').innerText = (interestRate * 100).toFixed(0);
}
