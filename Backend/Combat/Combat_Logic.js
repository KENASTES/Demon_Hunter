// 1. Mock Data
let player = { hp: 100, maxHp: 100, stats: { atk: 20, def: 15, mag: 25 } };
let enemy = { hp: 80, maxHp: 80, stats: { atk: 18, def: 10, mag: 5 } };
let isPlayerTurn = true;

// 2. DOM Elements
const logText = document.getElementById('log-text');
const enemyActionText = document.getElementById('enemy-action-text');
const buttons = document.querySelectorAll('.action-buttons button');

// 3. Core Logic: ตารางเป่ายิ้งฉุบ
function calculateDamage(pMove, eMove) {
    let damageToEnemy = 0;
    let damageToPlayer = 0;

    if (pMove === 'ATTACK') {
        if (eMove === 'DEFEND') {
            damageToEnemy = Math.max(1, player.stats.atk - (enemy.stats.def * 1.8));
        } else {
            damageToEnemy = Math.max(1, player.stats.atk - enemy.stats.def);
        }
    } 
    else if (pMove === 'STRIKE') {
        if (eMove === 'COUNTER') {
            damageToPlayer = Math.max(1, enemy.stats.atk * 1.8); // โดนสวน
            logText.innerText += `\nCountered! You took ${damageToPlayer} damage.`;
        } else {
            damageToEnemy = Math.max(1, (player.stats.atk * 2) - enemy.stats.def); // ทะลุ Defend/Clense
        }
    } 
    else if (pMove === 'MAGIC') {
        if (eMove === 'CLENSE') {
            damageToEnemy = 0; // ป้องกันเวทย์สมบูรณ์
            logText.innerText += `\nEnemy clensed your magic!`;
        } else {
            damageToEnemy = Math.max(1, player.stats.mag); // ทะลุกายภาพ
        }
    }

    return { toEnemy: Math.floor(damageToEnemy), toPlayer: Math.floor(damageToPlayer) };
}

// 4. ฟังก์ชันหน่วงเวลา
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 5. Flow การต่อสู้
async function handlePlayerAction(playerMove) {
    if (!isPlayerTurn) return;
    isPlayerTurn = false;
    toggleButtons(false);

    // ล้างข้อความเก่า
    enemyActionText.innerText = "-";
    logText.innerText = `You used ${playerMove}!`;

    await sleep(800); // หน่วงเวลาให้ศัตรูคิด

    // สุ่มท่าศัตรู
    const enemyMoves = ['DEFEND', 'COUNTER', 'CLENSE'];
    const enemyMove = enemyMoves[Math.floor(Math.random() * enemyMoves.length)];
    enemyActionText.innerText = `Uses: ${enemyMove}`;

    await sleep(800); // หน่วงเวลาแสดงท่าศัตรู

    // คำนวณผลลัพธ์
    const result = calculateDamage(playerMove, enemyMove);
    
    // อัปเดต HP
    enemy.hp = Math.max(0, enemy.hp - result.toEnemy);
    player.hp = Math.max(0, player.hp - result.toPlayer);
    
    if (result.toEnemy > 0) logText.innerText += `\nDealt ${result.toEnemy} damage!`;

    updateUI();

    await sleep(1000);

    // เช็คผลแพ้ชนะ
    if (enemy.hp <= 0) {
        logText.innerText = "You Win!";
        return; // จบเกม
    } else if (player.hp <= 0) {
        logText.innerText = "You Died!";
        return; // จบเกม
    }

    // เริ่มเทิร์นใหม่
    logText.innerText = "Your turn.";
    enemyActionText.innerText = "-";
    isPlayerTurn = true;
    toggleButtons(true);
}

// 6. Utility Functions
function toggleButtons(state) {
    buttons.forEach(btn => btn.disabled = !state);
}

function updateUI() {
    // อัปเดตฝั่งผู้เล่น
    document.getElementById('player-hp-text').innerText = `${player.hp} / ${player.maxHp}`;
    document.getElementById('player-hp-bar').style.width = `${(player.hp / player.maxHp) * 100}%`;
    
    // อัปเดตฝั่งศัตรู
    document.getElementById('enemy-hp-text').innerText = `${enemy.hp} / ${enemy.maxHp}`;
    document.getElementById('enemy-hp-bar').style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
}

// Initialize UI ครั้งแรก
updateUI();