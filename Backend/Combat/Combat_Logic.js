// ==========================================
// Combat Arena State
// ==========================================
const AI_URL = "https://teachablemachine.withgoogle.com/models/6Sl3sq4VT/";
const PLAYER_FORMS = {
    flex: {
        label: "Flex",
        idleClass: "char-flex",
    },
    aero: {
        label: "Aero",
        idleClass: "char-aero",
    },
    torque: {
        label: "Torque",
        idleClass: "char-torque",
    },
};

const ACTION_CLASSES = [
    "act-idle",
    "act-attack",
    "act-strike",
    "act-magic",
    "act-defend",
    "act-clense",
    "act-counter",
    "act-hit",
    "act-lowhp",
    "act-dead",
];

const OFFENSE_MOVES = ["ATTACK", "STRIKE", "MAGIC"];
const DEFENSE_MOVES = ["DEFEND", "COUNTER", "CLENSE"];
const MAX_LOG_LINES = 6;

const ENEMY_POOL = [
    {
        name: "Thorn",
        portrait: "../../Frontend/asset/Monster/Thorn.png",
        hp: 72,
        hpGain: 24,
        atk: 16,
        def: 11,
        mag: 8,
        exp: 42,
    },
    {
        name: "Black Mamba",
        portrait: "../../Frontend/asset/Monster/Black_Mamba.png",
        hp: 66,
        hpGain: 22,
        atk: 15,
        def: 12,
        mag: 16,
        exp: 48,
    },
    {
        name: "Flaming Cat",
        portrait: "../../Frontend/asset/Monster/Flaming_Cat.png",
        hp: 60,
        hpGain: 20,
        atk: 19,
        def: 9,
        mag: 12,
        exp: 46,
    },
    {
        name: "Deatwin",
        portrait: "../../Frontend/asset/Monster/Deatwin.png",
        hp: 78,
        hpGain: 26,
        atk: 18,
        def: 14,
        mag: 14,
        exp: 54,
    },
];

function createPlayer() {
    return {
        name: "Hunter",
        form: "flex",
        level: 1,
        exp: 0,
        expToNext: 100,
        statPoints: 0,
        hp: 100,
        maxHp: 100,
        stats: { atk: 20, def: 15, mag: 25 },
    };
}

function generateEnemy(level) {
    const template = ENEMY_POOL[Math.floor(Math.random() * ENEMY_POOL.length)];
    const tier = Math.max(0, level - 1);
    const maxHp = template.hp + tier * template.hpGain;
    return {
        name: template.name,
        portrait: template.portrait,
        level,
        hp: maxHp,
        maxHp,
        expDrop: template.exp + tier * 18,
        stats: {
            atk: template.atk + tier * 3,
            def: template.def + tier * 2,
            mag: template.mag + tier * 2,
        },
    };
}

let player = createPlayer();
let enemy = generateEnemy(player.level);
let isPlayerAttacker = true;
let isWaiting = false;
let battleRound = 1;
let playerForm = "flex";
let battleStarted = false;

let battleLog = [];
let aiModel = null;
let webcam = null;
let ctx = null;
let maxPredictions = 0;
let aiReady = false;
let poseCountdownActive = false;
let latestPoseLabel = "";
let latestPoseProbability = 0;
let countdownToken = 0;

// ==========================================
// DOM Cache
// ==========================================
const DOM = {
    roundText: document.getElementById("round-text"),
    turnLabel: document.getElementById("turn-label"),
    aiStatus: document.getElementById("ai-status"),
    stageBanner: document.getElementById("stage-banner"),
    logText: document.getElementById("log-text"),
    enemyActionText: document.getElementById("enemy-action-text"),
    playerLevelText: document.getElementById("player-level-text"),
    playerHpText: document.getElementById("player-hp-text"),
    playerHpBar: document.getElementById("player-hp-bar"),
    playerAtk: document.getElementById("player-atk"),
    playerDef: document.getElementById("player-def"),
    playerMag: document.getElementById("player-mag"),
    playerExp: document.getElementById("player-exp"),
    playerName: document.getElementById("player-name"),
    playerFormText: document.getElementById("player-form-text"),
    playerSprite: document.getElementById("player-sprite"),
    enemyLevelText: document.getElementById("enemy-level-text"),
    enemyHpText: document.getElementById("enemy-hp-text"),
    enemyHpBar: document.getElementById("enemy-hp-bar"),
    enemyAtk: document.getElementById("enemy-atk"),
    enemyDef: document.getElementById("enemy-def"),
    enemyMag: document.getElementById("enemy-mag"),
    enemyDrop: document.getElementById("enemy-drop"),
    enemyName: document.getElementById("enemy-name"),
    enemyBannerName: document.getElementById("enemy-banner-name"),
    enemySprite: document.getElementById("enemy-sprite"),
    btnStartBattle: document.getElementById("btn-start-battle"),
    aiCountdown: document.getElementById("ai-countdown"),
    levelUpModal: document.getElementById("level-up-modal"),
    currentLevel: document.getElementById("current-level"),
    statPoints: document.getElementById("stat-points"),
    btnCloseModal: document.getElementById("btn-close-modal"),
    canvas: document.getElementById("canvas"),
};

// ==========================================
// Utilities
// ==========================================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function isModalOpen() {
    return DOM.levelUpModal && !DOM.levelUpModal.hidden;
}

function normalizePoseLabel(label) {
    return String(label || "")
        .toLowerCase()
        .replace(/[_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function moveToDisplay(move) {
    switch (move) {
        case "ATTACK":
            return "Attack";
        case "STRIKE":
            return "Strike";
        case "MAGIC":
            return "Magic";
        case "DEFEND":
            return "Defense";
        case "COUNTER":
            return "Counter";
        case "CLENSE":
            return "Cleanse";
        default:
            return move;
    }
}

function pushLog(message) {
    battleLog.unshift(message);
    battleLog = battleLog.slice(0, MAX_LOG_LINES);
    if (DOM.logText) {
        DOM.logText.textContent = battleLog.join("\n");
    }
}

function setStageBanner(message) {
    if (DOM.stageBanner) {
        DOM.stageBanner.textContent = message;
    }
}

function setEnemyAction(message) {
    if (DOM.enemyActionText) {
        DOM.enemyActionText.textContent = message;
    }
}

function startBattle() {
    if (!aiReady || battleStarted) {
        return;
    }

    battleStarted = true;
    latestPoseLabel = "";
    latestPoseProbability = 0;
    if (DOM.btnStartBattle) {
        DOM.btnStartBattle.disabled = true;
    }
    pushLog("Battle started.");
    setStageBanner("Battle started. Hold your pose until countdown reaches 0.");
    aiReadyMessage("Battle ready. Hold your pose.");
    updateUI();
    if (isPlayerAttacker) {
        beginPoseCountdown();
    }
}

function getBattleStats(target) {
    return {
        atk: target.stats.atk,
        def: target.stats.def,
        mag: target.stats.mag,
    };
}

function applyVariance(value) {
    if (value <= 0) {
        return 0;
    }
    const factor = 0.9 + Math.random() * 0.2;
    return Math.max(0, Math.round(value * factor));
}

function updateSpriteState(el, target) {
    if (!el || !target) {
        return;
    }

    ACTION_CLASSES.forEach((cls) => el.classList.remove(cls));

    if (target.hp <= 0) {
        el.classList.add("act-dead");
    } else if (target.hp <= target.maxHp * 0.3) {
        el.classList.add("act-lowhp");
    } else {
        el.classList.add("act-idle");
    }
}

function playAnimation(targetId, actionClass, durationMs = 0) {
    const el = document.getElementById(targetId);
    if (!el) {
        return;
    }

    ACTION_CLASSES.forEach((cls) => el.classList.remove(cls));
    el.classList.add(actionClass);

    if (durationMs > 0) {
        setTimeout(() => {
            const target = targetId === "player-sprite" ? player : enemy;
            updateSpriteState(el, target);
        }, durationMs);
    }
}

function isPlayerMove(move) {
    return OFFENSE_MOVES.includes(move);
}

function isDefenseMove(move) {
    return DEFENSE_MOVES.includes(move);
}

function getPlayerFormClass() {
    return PLAYER_FORMS[playerForm]?.idleClass || "char-flex";
}

function syncSpriteClasses() {
    if (DOM.playerSprite) {
        DOM.playerSprite.classList.remove("char-flex", "char-aero", "char-torque");
        DOM.playerSprite.classList.add(getPlayerFormClass());
    }

    if (DOM.enemySprite) {
        DOM.enemySprite.classList.add("enemy-placeholder");
    }
}

function setPlayerCharacter(formName) {
    const nextForm = String(formName || "").toLowerCase().trim();
    if (!PLAYER_FORMS[nextForm]) {
        return false;
    }

    playerForm = nextForm;
    player.form = nextForm;
    if (DOM.playerFormText) {
        DOM.playerFormText.textContent = PLAYER_FORMS[nextForm].label.toUpperCase();
    }
    syncSpriteClasses();
    updateSpriteState(DOM.playerSprite, player);
    updateUI();
    return true;
}

function syncTopBanner() {
    if (DOM.roundText) {
        DOM.roundText.textContent = String(battleRound);
    }

    if (DOM.turnLabel) {
        DOM.turnLabel.textContent = isPlayerAttacker ? "Player Turn" : "Enemy Turn";
        DOM.turnLabel.classList.toggle("turn-player", isPlayerAttacker);
        DOM.turnLabel.classList.toggle("turn-enemy", !isPlayerAttacker);
    }

    if (DOM.stageBanner && !isModalOpen()) {
        DOM.stageBanner.textContent = isWaiting
            ? "Combat is resolving..."
            : isPlayerAttacker
                ? "Attack phase: pose ATTACK / STRIKE / MAGIC"
                : "Defense phase: pose DEFEND / COUNTER / CLEANSE";
    }
}

function updateModalUI() {
    if (DOM.currentLevel) {
        DOM.currentLevel.textContent = String(player.level);
    }
    if (DOM.statPoints) {
        DOM.statPoints.textContent = String(player.statPoints);
    }
    if (DOM.btnCloseModal) {
        DOM.btnCloseModal.disabled = player.statPoints > 0;
    }
}

function updateUI() {
    syncSpriteClasses();
    syncTopBanner();

    const playerTotals = getBattleStats(player);
    const enemyTotals = getBattleStats(enemy);

    if (DOM.playerLevelText) {
        DOM.playerLevelText.textContent = `Lv.${player.level}`;
    }
    if (DOM.playerHpText) {
        DOM.playerHpText.textContent = `${player.hp} / ${player.maxHp}`;
    }
    if (DOM.playerHpBar) {
        DOM.playerHpBar.style.width = `${clamp((player.hp / player.maxHp) * 100, 0, 100)}%`;
    }
    if (DOM.playerAtk) {
        DOM.playerAtk.textContent = String(playerTotals.atk);
    }
    if (DOM.playerDef) {
        DOM.playerDef.textContent = String(playerTotals.def);
    }
    if (DOM.playerMag) {
        DOM.playerMag.textContent = String(playerTotals.mag);
    }
    if (DOM.playerExp) {
        DOM.playerExp.textContent = `${player.exp} / ${player.expToNext}`;
    }
    if (DOM.playerName) {
        DOM.playerName.textContent = player.name;
    }
    if (DOM.playerFormText) {
        DOM.playerFormText.textContent = PLAYER_FORMS[playerForm]?.label.toUpperCase() || "FLEX";
    }

    if (DOM.enemyLevelText) {
        DOM.enemyLevelText.textContent = `Lv.${enemy.level}`;
    }
    if (DOM.enemyHpText) {
        DOM.enemyHpText.textContent = `${enemy.hp} / ${enemy.maxHp}`;
    }
    if (DOM.enemyHpBar) {
        DOM.enemyHpBar.style.width = `${clamp((enemy.hp / enemy.maxHp) * 100, 0, 100)}%`;
    }
    if (DOM.enemyAtk) {
        DOM.enemyAtk.textContent = String(enemyTotals.atk);
    }
    if (DOM.enemyDef) {
        DOM.enemyDef.textContent = String(enemyTotals.def);
    }
    if (DOM.enemyMag) {
        DOM.enemyMag.textContent = String(enemyTotals.mag);
    }
    if (DOM.enemyDrop) {
        DOM.enemyDrop.textContent = String(enemy.expDrop);
    }
    if (DOM.enemyName) {
        DOM.enemyName.textContent = enemy.name;
    }
    if (DOM.enemyBannerName) {
        DOM.enemyBannerName.textContent = enemy.name;
    }
    if (DOM.btnStartBattle) {
        DOM.btnStartBattle.textContent = battleStarted ? "Battle Ready" : "Start Battle";
        DOM.btnStartBattle.disabled = battleStarted;
    }

    updateModalUI();
    updateSpriteState(DOM.playerSprite, player);
    updateSpriteState(DOM.enemySprite, enemy);
}

function modalOpenSet(open) {
    if (!DOM.levelUpModal) {
        return;
    }
    DOM.levelUpModal.hidden = !open;
    DOM.levelUpModal.style.display = open ? "grid" : "none";
}

function resetTurnFlags() {
    // no side items in this version
}

function getPoseMove(poseName) {
    const key = normalizePoseLabel(poseName);
    if (key === "idle") {
        return "ATTACK";
    }
    if (key === "physical" || key === "normal") {
        return "ATTACK";
    }
    if (key === "magic") {
        return "MAGIC";
    }
    if (key === "strike") {
        return "STRIKE";
    }
    if (key === "physical defense") {
        return "DEFEND";
    }
    if (key === "magic defense") {
        return "CLENSE";
    }
    if (key === "counter") {
        return "COUNTER";
    }
    return null;
}

function showCountdownFrame(text) {
    if (!DOM.aiCountdown) {
        return;
    }
    DOM.aiCountdown.style.display = "block";
    DOM.aiCountdown.textContent = text;
}

function hideCountdownFrame() {
    if (!DOM.aiCountdown) {
        return;
    }
    DOM.aiCountdown.style.display = "none";
}

async function beginPoseCountdown() {
    if (!battleStarted || !isPlayerAttacker || isWaiting || isModalOpen() || poseCountdownActive) {
        return;
    }

    poseCountdownActive = true;
    const runToken = ++countdownToken;
    latestPoseLabel = "";
    latestPoseProbability = 0;
    aiReadyMessage("Hold your pose...");

    const frames = ["3", "2", "1", "0"];
    for (const frame of frames) {
        if (runToken !== countdownToken || !battleStarted || isWaiting || isModalOpen() || !isPlayerAttacker) {
            poseCountdownActive = false;
            hideCountdownFrame();
            return;
        }
        showCountdownFrame(frame);
        await sleep(700);
    }

    hideCountdownFrame();

    if (runToken !== countdownToken || !battleStarted || isWaiting || isModalOpen() || !isPlayerAttacker) {
        poseCountdownActive = false;
        return;
    }

    const capturedLabel = latestPoseLabel || "idle";
    const capturedProbability = latestPoseProbability;
    latestPoseLabel = "";
    latestPoseProbability = 0;

    if (capturedProbability < 0.8) {
        pushLog("Pose missed. Try again on the next countdown.");
        poseCountdownActive = false;
        if (battleStarted && isPlayerAttacker && !isWaiting && !isModalOpen()) {
            setTimeout(() => {
                if (battleStarted && isPlayerAttacker && !isWaiting && !isModalOpen()) {
                    beginPoseCountdown();
                }
            }, 350);
        }
        return;
    }

    const triggered = await triggerGameAction(capturedLabel);
    poseCountdownActive = false;
    if (!triggered && battleStarted && isPlayerAttacker && !isWaiting && !isModalOpen()) {
        pushLog("Wrong pose for this phase. Try again.");
        setTimeout(() => {
            if (battleStarted && isPlayerAttacker && !isWaiting && !isModalOpen()) {
                beginPoseCountdown();
            }
        }, 350);
    }
}

function chooseWeightedMove(entries) {
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) {
            return entry.move;
        }
    }
    return entries[entries.length - 1].move;
}

function chooseEnemyDefenseMove() {
    const healthRatio = enemy.hp / enemy.maxHp;
    if (healthRatio < 0.35) {
        return chooseWeightedMove([
            { move: "CLENSE", weight: 42 },
            { move: "DEFEND", weight: 38 },
            { move: "COUNTER", weight: 20 },
        ]);
    }

    return chooseWeightedMove([
        { move: "DEFEND", weight: 42 },
        { move: "COUNTER", weight: 33 },
        { move: "CLENSE", weight: 25 },
    ]);
}

function chooseEnemyAttackMove() {
    const healthRatio = player.hp / player.maxHp;
    if (healthRatio < 0.35) {
        return chooseWeightedMove([
            { move: "STRIKE", weight: 45 },
            { move: "MAGIC", weight: 35 },
            { move: "ATTACK", weight: 20 },
        ]);
    }

    if (enemy.stats.mag >= enemy.stats.atk) {
        return chooseWeightedMove([
            { move: "MAGIC", weight: 42 },
            { move: "STRIKE", weight: 33 },
            { move: "ATTACK", weight: 25 },
        ]);
    }

    return chooseWeightedMove([
        { move: "ATTACK", weight: 42 },
        { move: "STRIKE", weight: 33 },
        { move: "MAGIC", weight: 25 },
    ]);
}

function calculateDamage(attacker, defender, atkMove, defMove) {
    const a = getBattleStats(attacker);
    const d = getBattleStats(defender);
    let toDefender = 0;
    let toAttacker = 0;

    if (atkMove === "ATTACK") {
        toDefender = Math.max(4, a.atk * 1.35 - d.def * 0.65);
        if (defMove === "DEFEND") toDefender *= 0.65;
        if (defMove === "COUNTER") toDefender *= 0.85;
        if (defMove === "CLENSE") toDefender *= 0.9;
    } else if (atkMove === "STRIKE") {
        toDefender = Math.max(8, a.atk * 1.85 - d.def * 0.5);
        if (defMove === "DEFEND") toDefender *= 0.82;
        if (defMove === "COUNTER") {
            toDefender *= 0.5;
            toAttacker = Math.max(6, d.atk * 1.25 - a.def * 0.35);
        }
        if (defMove === "CLENSE") toDefender *= 0.95;
    } else if (atkMove === "MAGIC") {
        toDefender = Math.max(7, a.mag * 1.8 - d.mag * 0.35);
        if (defMove === "CLENSE") {
            toDefender = 0;
        } else if (defMove === "DEFEND") {
            toDefender *= 0.82;
        } else if (defMove === "COUNTER") {
            toDefender *= 0.9;
        }
    }

    return {
        toDefender: applyVariance(toDefender),
        toAttacker: applyVariance(toAttacker),
    };
}

function applyDamage(attacker, defender, atkMove, defMove) {
    const result = calculateDamage(attacker, defender, atkMove, defMove);
    defender.hp = clamp(defender.hp - result.toDefender, 0, defender.maxHp);
    attacker.hp = clamp(attacker.hp - result.toAttacker, 0, attacker.maxHp);
    return result;
}

function actionForMove(move) {
    switch (move) {
        case "ATTACK":
            return "act-attack";
        case "STRIKE":
            return "act-strike";
        case "MAGIC":
            return "act-magic";
        case "DEFEND":
            return "act-defend";
        case "COUNTER":
            return "act-counter";
        case "CLENSE":
            return "act-clense";
        default:
            return "act-idle";
    }
}

async function runActionSequence(attackerId, defenderId, atkMove, defMove, attackerName) {
    playAnimation(attackerId, actionForMove(atkMove), 700);
    playAnimation(defenderId, actionForMove(defMove), 700);
    setStageBanner(`${attackerName} uses ${moveToDisplay(atkMove)}.`);
    await sleep(650);
}

function resetBattleRound() {
    battleRound = 1;
    updateUI();
}

async function handleEnemyDefeat() {
    pushLog(`Victory! ${enemy.name} was defeated.`);
    setEnemyAction("-");
    setStageBanner(`${enemy.name} has fallen.`);
    updateUI();

    await gainExp(enemy.expDrop);

    isWaiting = true;

    await sleep(2200);

    enemy = generateEnemy(player.level);
    resetBattleRound();
    isPlayerAttacker = true;
    isWaiting = false;
    resetTurnFlags();
    setEnemyAction("-");
    pushLog(`A new ${enemy.name} appears. Your attack phase begins.`);
    setStageBanner("Attack phase: pose ATTACK / STRIKE / MAGIC");
    updateUI();
    if (battleStarted) {
        beginPoseCountdown();
    }
}

async function handlePlayerDefeat() {
    pushLog("You were defeated. Refresh the page to try again.");
    setEnemyAction("-");
    setStageBanner("Game Over");
    isWaiting = true;
    updateUI();
}

async function handleTurn(playerMove) {
    if (isWaiting || isModalOpen()) {
        return;
    }

    const normalizedMove = String(playerMove || "").toUpperCase().trim();
    const validMove = isPlayerAttacker ? isPlayerMove(normalizedMove) : isDefenseMove(normalizedMove);
    if (!validMove) {
        return;
    }

    isWaiting = true;

    const attacker = isPlayerAttacker ? player : enemy;
    const defender = isPlayerAttacker ? enemy : player;
    const enemyMove = isPlayerAttacker ? chooseEnemyDefenseMove() : chooseEnemyAttackMove();
    const atkMove = isPlayerAttacker ? normalizedMove : enemyMove;
    const defMove = isPlayerAttacker ? enemyMove : normalizedMove;
    const attackerSpriteId = isPlayerAttacker ? "player-sprite" : "enemy-sprite";
    const defenderSpriteId = isPlayerAttacker ? "enemy-sprite" : "player-sprite";
    const attackerName = isPlayerAttacker ? "You" : enemy.name;

    setEnemyAction(`Enemy choice: ${enemyMove}`);
    pushLog(
        isPlayerAttacker
            ? `You chose ${moveToDisplay(atkMove)}. Enemy prepares ${moveToDisplay(defMove)}.`
            : `${enemy.name} used ${moveToDisplay(atkMove)}. You answer with ${moveToDisplay(defMove)}.`
    );

    await sleep(450);
    await runActionSequence(attackerSpriteId, defenderSpriteId, atkMove, defMove, attackerName);

    const result = applyDamage(attacker, defender, atkMove, defMove);

    if (result.toDefender > 0) {
        playAnimation(defenderSpriteId, "act-hit", 340);
    }
    if (result.toAttacker > 0) {
        playAnimation(attackerSpriteId, "act-hit", 340);
    }

    if (result.toDefender > 0) {
        pushLog(`${defender === player ? "You" : enemy.name} took ${result.toDefender} damage.`);
    } else if (atkMove === "MAGIC" && defMove === "CLENSE") {
        pushLog("Cleanse nullified the magic burst.");
    } else {
        pushLog("The attack was fully guarded.");
    }

    if (result.toAttacker > 0) {
        pushLog(`${attacker === player ? "You" : enemy.name} took ${result.toAttacker} counter damage.`);
    }

    updateUI();
    await sleep(900);

    if (enemy.hp <= 0) {
        await handleEnemyDefeat();
        return;
    }

    if (player.hp <= 0) {
        await handlePlayerDefeat();
        return;
    }

    isPlayerAttacker = !isPlayerAttacker;
    battleRound += 1;
    isWaiting = false;
    setEnemyAction("-");
    setStageBanner(
        isPlayerAttacker
            ? "Attack phase: pose ATTACK / STRIKE / MAGIC"
            : "Defense phase: pose DEFEND / COUNTER / CLEANSE"
    );
    resetTurnFlags();
    updateUI();
    if (battleStarted && isPlayerAttacker && !isWaiting && !isModalOpen()) {
        beginPoseCountdown();
    }
}

function handlePlayerAction(move) {
    handleTurn(move);
}

function allocateStat(statName) {
    if (player.statPoints <= 0) {
        return;
    }

    if (!["atk", "def", "mag"].includes(statName)) {
        return;
    }

    player.stats[statName] += 1;
    player.statPoints -= 1;
    player.maxHp += 5;
    player.hp = player.maxHp;
    pushLog(`Allocated +1 ${statName.toUpperCase()}.`);
    updateUI();
    updateModalUI();
}

function closeLevelUpModal() {
    if (player.statPoints > 0) {
        return;
    }

    modalOpenSet(false);
    updateUI();
}

function showLevelUpModal() {
    modalOpenSet(true);
    isWaiting = true;
    updateModalUI();
    setStageBanner("Level up reached. Allocate your points.");
}

async function gainExp(amount) {
    player.exp += amount;
    updateUI();
    await sleep(350);

    while (player.exp >= player.expToNext) {
        player.exp -= player.expToNext;
        player.level += 1;
        player.expToNext = Math.floor(player.expToNext * 1.45);
        player.statPoints += 3;
        player.maxHp += 10;
        player.hp = player.maxHp;
    }

    if (player.statPoints > 0) {
        pushLog(`LEVEL UP! You reached Lv.${player.level}.`);
        showLevelUpModal();
        updateUI();
    }
}

function wireEvents() {
    DOM.btnStartBattle?.addEventListener("click", startBattle);
    DOM.btnCloseModal?.addEventListener("click", closeLevelUpModal);
}

function triggerGameAction(aiClassName) {
    const move = getPoseMove(aiClassName);
    if (!move) {
        return false;
    }

    if (isPlayerAttacker && isPlayerMove(move)) {
        handleTurn(move);
        return true;
    } else if (!isPlayerAttacker && isDefenseMove(move)) {
        handleTurn(move);
        return true;
    }

    return false;
}

function drawPose(pose) {
    if (!webcam || !webcam.canvas || !ctx) {
        return;
    }

    ctx.drawImage(webcam.canvas, 0, 0);
    if (pose) {
        tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
        tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
    }
}

function aiReadyMessage(message, isError = false) {
    if (DOM.aiStatus) {
        DOM.aiStatus.textContent = message;
        DOM.aiStatus.style.color = isError ? "#ff8aa2" : "";
    }
}

async function initAI() {
    try {
        const modelURL = `${AI_URL}model.json`;
        const metadataURL = `${AI_URL}metadata.json`;
        aiModel = await tmPose.load(modelURL, metadataURL);
        maxPredictions = aiModel.getTotalClasses();

        const size = 160;
        webcam = new tmPose.Webcam(size, size, true);
        await webcam.setup();
        await webcam.play();

        if (DOM.canvas) {
            DOM.canvas.width = size;
            DOM.canvas.height = size;
            ctx = DOM.canvas.getContext("2d");
        }

        aiReady = true;
        aiReadyMessage("AI Ready. Press START BATTLE.");
        window.requestAnimationFrame(aiLoop);
    } catch (error) {
        console.error("AI init failed:", error);
        aiReadyMessage("AI unavailable - use buttons.", true);
    }
}

async function aiLoop() {
    if (webcam) {
        webcam.update();
        await predictPose();
    }
    window.requestAnimationFrame(aiLoop);
}

async function predictPose() {
    if (!aiModel || !webcam || isWaiting || isModalOpen()) {
        return;
    }

    const { pose, posenetOutput } = await aiModel.estimatePose(webcam.canvas);
    const prediction = await aiModel.predict(posenetOutput);
    drawPose(pose);

    let highestProb = 0;
    let bestClass = "";

    for (let i = 0; i < maxPredictions; i += 1) {
        if (prediction[i].probability > highestProb) {
            highestProb = prediction[i].probability;
            bestClass = prediction[i].className;
        }
    }

    if (highestProb < 0.8) {
        aiReadyMessage(battleStarted ? "Pose unclear. Hold steady." : "Press START BATTLE.");
        return;
    }

    const normalized = normalizePoseLabel(bestClass);
    if (battleStarted && isPlayerAttacker && poseCountdownActive) {
        aiReadyMessage(`Lock pose: ${bestClass} (${Math.round(highestProb * 100)}%)`);
        latestPoseLabel = normalized;
        latestPoseProbability = highestProb;
        return;
    }

    if (battleStarted && isPlayerAttacker) {
        aiReadyMessage(`Waiting for countdown... ${bestClass} (${Math.round(highestProb * 100)}%)`);
    } else if (battleStarted) {
        aiReadyMessage(`Enemy turn... ${bestClass} (${Math.round(highestProb * 100)}%)`);
    } else {
        aiReadyMessage("AI Ready. Press START BATTLE.");
    }

    latestPoseLabel = normalized;
    latestPoseProbability = highestProb;
}

function initGame() {
    wireEvents();
    modalOpenSet(false);

    setPlayerCharacter(player.form || "flex");
    if (DOM.enemySprite) {
        DOM.enemySprite.classList.add("enemy-placeholder");
    }

    pushLog("Combat ready. Press START BATTLE to begin.");
    setStageBanner("Press START BATTLE to begin.");
    updateUI();
    initAI();
}

// ==========================================
// Boot
// ==========================================
window.addEventListener("load", initGame);
window.handlePlayerAction = handlePlayerAction;
window.allocateStat = allocateStat;
window.closeLevelUpModal = closeLevelUpModal;
window.setPlayerCharacter = setPlayerCharacter;
