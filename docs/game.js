// Game Configuration
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    scene: { preload: preload, create: create, update: update }
};

let game = new Phaser.Game(config);
let gold = 100;
let rate = 0.05; // 5% Interest

function preload() {
    // This is where you will load images later
}

function create() {
    console.log("Game World Initialized");
    
    // Update the gold balance every 3 seconds
    setInterval(() => {
        gold = gold + (gold * rate);
        document.getElementById('gold-count').innerText = Math.floor(gold);
    }, 3000);
}

function update() {
    // This runs 60 times per second for animations
}
