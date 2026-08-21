// 1. Mock Data & State
let player = { 
    level: 1, exp: 0, expToNext: 100, statPoints: 0,
    hp: 100, maxHp: 100, 
    stats: { atk: 20, def: 15, mag: 25 } 
};

function generateEnemy(level) {
    return {
        name: "Goblin",
        level: level,
        hp: 60 + (level * 20),
        maxHp: 60 + (level * 20),
        expDrop: 40 + (level * 25), // ยิ่งเวลสูง ยิ่งดรอปเยอะ
        stats: {
            atk: 15 + (level * 3),
            def: 10 + (level * 2),
            mag: 5 + (level * 1)
        }
    };
}

let enemy = generateEnemy(player.level);
let isPlayerAttacker = true; // true = เราตี, false = เราป้องกัน
let isWaiting = false; // ป้องกันผู้เล่นกดปุ่มรัวๆ ตอนแอนิเมชันกำลังเล่น

// 2. DOM Elements
const logText = document.getElementById('log-text');
const enemyActionText = document.getElementById('enemy-action-text');
const btn1 = document.getElementById('btn-attack');
const btn2 = document.getElementById('btn-strike');
const btn3 = document.getElementById('btn-magic');

// 3. Core Logic: ตารางคำนวณดาเมจ (ปรับสมการใหม่ให้ตีเข้าเสมอ)
function calculateDamage(attacker, defender, atkMove, defMove) {
    let dmgToDefender = 0;
    let dmgToAttacker = 0;

    // ดึงค่าสเตตัสมาเก็บในตัวแปรสั้นๆ เพื่อให้สูตรดูอ่านง่าย
    const a_atk = attacker.stats.atk;
    const a_def = attacker.stats.def;
    const a_mag = attacker.stats.mag;
    
    const d_atk = defender.stats.atk;
    const d_def = defender.stats.def;
    const d_mag = defender.stats.mag; // ในที่นี้ใช้ MAG เป็นค่าต้านทานเวทย์ไปในตัว

    // ฟังก์ชันคำนวณสมการ RPG มาตรฐาน: (Power^2) / (Power + Defense)
    const calcHit = (power, resistance) => {
        return (power * power) / (power + resistance);
    };

    if (atkMove === 'ATTACK') {
        if (defMove === 'DEFEND') {
            // โจมตีปกติ เจอป้องกัน: ฝั่งรับได้โบนัส DEF 2 เท่า
            dmgToDefender = calcHit(a_atk, d_def * 2);
        } else {
            // โจมตีปกติ: หักลบด้วย DEF ปกติ
            dmgToDefender = calcHit(a_atk, d_def);
        }
    } 
    else if (atkMove === 'STRIKE') {
        if (defMove === 'COUNTER') {
            // โจมตีหนัก โดนสวนกลับ: ผู้โจมตีรับดาเมจแทน โดยศัตรูสวนด้วย ATK 1.5 เท่า เจาะ DEF เรา
            dmgToAttacker = calcHit(d_atk * 1.5, a_def); 
        } else {
            // โจมตีหนัก ทะลุการป้องกัน: พลังโจมตี (ATK) ของเราคูณ 2 แต่ศัตรูใช้ DEF ปกติ
            dmgToDefender = calcHit(a_atk * 2, d_def); 
        }
    } 
    else if (atkMove === 'MAGIC') {
        if (defMove === 'CLENSE') {
            // เวทย์ เจอ ล้างเวทย์: ดาเมจเป็น 0 สมบูรณ์แบบ
            dmgToDefender = 0; 
        } else {
            // เวทย์: ใช้ MAG ฝั่งเรา โจมตีใส่ MAG ฝั่งศัตรู
            dmgToDefender = calcHit(a_mag * 1.5, d_mag); 
        }
    }

    // สุ่มดาเมจแกว่ง (Variance ±10%) แล้วปัดเศษให้เป็นจำนวนเต็ม
    const variance = (val) => Math.floor(val * (0.9 + Math.random() * 0.2));
    
    return { 
        toDefender: variance(dmgToDefender), 
        toAttacker: variance(dmgToAttacker) 
    };
}

// 4. UI Controllers
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function toggleButtons(state) {
    btn1.disabled = !state;
    btn2.disabled = !state;
    btn3.disabled = !state;
}

function updateUI() {
    document.getElementById('player-hp-text').innerText = `${player.hp} / ${player.maxHp}`;
    document.getElementById('player-hp-bar').style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById('player-atk').innerText = player.stats.atk;
    document.getElementById('player-def').innerText = player.stats.def;
    document.getElementById('player-mag').innerText = player.stats.mag;
    
    document.getElementById('enemy-hp-text').innerText = `${enemy.hp} / ${enemy.maxHp}`;
    document.getElementById('enemy-hp-bar').style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    document.getElementById('enemy-atk').innerText = enemy.stats.atk;
    document.getElementById('enemy-def').innerText = enemy.stats.def;
    document.getElementById('enemy-mag').innerText = enemy.stats.mag;

    // เปลี่ยนข้อความและฟังก์ชันของปุ่มตามสถานะว่าเราเป็นฝ่าย "รุก" หรือ "รับ"
    if (isPlayerAttacker) {
        btn1.innerText = "Attack";  btn1.onclick = () => handleTurn('ATTACK');
        btn2.innerText = "Strike";  btn2.onclick = () => handleTurn('STRIKE');
        btn3.innerText = "Magic";   btn3.onclick = () => handleTurn('MAGIC');
    } else {
        btn1.innerText = "Defend";  btn1.onclick = () => handleTurn('DEFEND');
        btn2.innerText = "Counter"; btn2.onclick = () => handleTurn('COUNTER');
        btn3.innerText = "Clense";  btn3.onclick = () => handleTurn('CLENSE');
    }
}

// 5. Flow การต่อสู้ (สลับเทิร์น)
async function handleTurn(playerMove) {
    if (isWaiting) return;
    isWaiting = true;
    toggleButtons(false);

    let atkMove, defMove, attacker, defender, enemyMove;

    // เฟส 1: ระบุว่าใครเป็นคนตี ใครเป็นคนรับ
    if (isPlayerAttacker) {
        const enemyDefMoves = ['DEFEND', 'COUNTER', 'CLENSE'];
        enemyMove = enemyDefMoves[Math.floor(Math.random() * enemyDefMoves.length)];
        atkMove = playerMove;
        defMove = enemyMove;
        attacker = player;
        defender = enemy;
        logText.innerText = `You prepare to ${atkMove}...`;
    } else {
        const enemyAtkMoves = ['ATTACK', 'STRIKE', 'MAGIC'];
        enemyMove = enemyAtkMoves[Math.floor(Math.random() * enemyAtkMoves.length)];
        atkMove = enemyMove;
        defMove = playerMove;
        attacker = enemy;
        defender = player;
        logText.innerText = `Enemy prepares to ${atkMove}! You use ${defMove}.`;
    }

    await sleep(800);
    enemyActionText.innerText = `Enemy choice: ?????`; // สร้างความตื่นเต้น
    await sleep(600);
    enemyActionText.innerText = `Enemy choice: ${enemyMove}`;

    // เฟส 2: คำนวณดาเมจ
    const result = calculateDamage(attacker, defender, atkMove, defMove);
    defender.hp = Math.max(0, defender.hp - result.toDefender);
    attacker.hp = Math.max(0, attacker.hp - result.toAttacker);
    
    // เฟส 3: รายงานผล (Combat Log)
    if (result.toDefender > 0) {
        logText.innerText += `\n-> ${attacker === player ? 'Enemy' : 'You'} took ${result.toDefender} damage!`;
    } else if (result.toDefender === 0 && atkMove === 'MAGIC' && defMove === 'CLENSE') {
        logText.innerText += `\n-> Magic was clensed! No damage.`;
    }

    if (result.toAttacker > 0) {
        logText.innerText += `\n-> COUNTER SUCCESS! ${attacker === player ? 'You' : 'Enemy'} took ${result.toAttacker} damage!`;
    }

    if (enemy.hp <= 0) {
        logText.innerText = "BATTLE WON!";
        enemyActionText.innerText = "-";
        gainExp(enemy.expDrop); // เรียกใช้ฟังก์ชันรับ EXP
        return; 
    } else if (player.hp <= 0) {
        logText.innerText = "YOU DIED!";
        enemyActionText.innerText = "-";
        return; 
    }

    updateUI();
    await sleep(1500);

    // เฟส 4: เช็คผลแพ้ชนะ
    if (enemy.hp <= 0 || player.hp <= 0) {
        logText.innerText = player.hp > 0 ? "BATTLE WON!" : "YOU DIED!";
        enemyActionText.innerText = "-";
        return; 
    }

    // เฟส 5: สลับเทิร์นและเตรียมเริ่มรอบใหม่
    isPlayerAttacker = !isPlayerAttacker;
    updateUI(); // เปลี่ยนชุดปุ่ม
    
    logText.innerText = isPlayerAttacker ? "Your turn to ATTACK!" : "Enemy is preparing to attack. Choose DEFENSE!";
    enemyActionText.innerText = "-";
    
    isWaiting = false;
    toggleButtons(true);
}

async function gainExp(amount) {
    player.exp += amount;
    logText.innerText = `You gained ${amount} EXP!`;
    updateUI();

    await sleep(1000);

    if (player.exp >= player.expToNext) {
        player.level++;
        player.exp -= player.expToNext; // หัก EXP ที่ใช้ไป
        player.expToNext = Math.floor(player.expToNext * 1.5); // เพิ่มเพดาน EXP สำหรับเลเวลถัดไป
        player.statPoints += 3; // ได้พ้อยท์อัปสเตตัส 3 แต้ม
        
        // ฟื้นฟู HP เต็มเมื่อเวลอัป (เหมือนเกม RPG ทั่วไป)
        player.maxHp += 10;
        player.hp = player.maxHp; 

        logText.innerText = `LEVEL UP! You reached Lv.${player.level}!`;
        showLevelUpModal();
    } else {
        logText.innerText = `Battle Ended.`;
        // ตรงนี้ในอนาคตจะส่งคำสั่งกลับไปฝั่ง Map
    }
}

function showLevelUpModal() {
    document.getElementById('level-up-modal').style.display = 'block';
    updateModalUI();
}

function updateModalUI() {
    document.getElementById('current-level').innerText = player.level;
    document.getElementById('stat-points').innerText = player.statPoints;
    
    // บังคับให้ปุ่ม Confirm กดได้ก็ต่อเมื่อใช้แต้มหมดแล้ว
    const btnClose = document.getElementById('btn-close-modal');
    btnClose.disabled = player.statPoints > 0;
}

function allocateStat(statName) {
    if (player.statPoints > 0) {
        player.stats[statName]++;
        player.statPoints--;
        updateUI(); // อัปเดตตัวเลขซ้ายบนแบบ Real-time
        updateModalUI();
    }
}

function closeLevelUpModal() {
    document.getElementById('level-up-modal').style.display = 'none';
    logText.innerText = `Stats upgraded! Battle Ended.`;
    // ตรงนี้ในอนาคตจะส่งคำสั่งกลับไปฝั่ง Map
}

// 6. Initialize (เริ่มเกม)
updateUI();
logText.innerText = "Combat starts! Your turn to ATTACK!";