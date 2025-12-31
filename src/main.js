// 使用全局 CONFIG（通过 index.html 先加载 src/config.js）
// 本文件包含回合制战斗的核心逻辑：轮次推进、玩家操作、敌人AI与胜负判定。

// 游戏整体状态：角色列表、当前轮到谁、是否结束
const state = {
  characters: [
    new Character(0, '玩家 (你)', CONFIG.playerHp, CONFIG.playerAtk, true, [window.SKILLS.Attack, window.SKILLS.ChaosTripleStrike]),
    new Character(1, 'Alleria', CONFIG.defaultHp, CONFIG.defaultAtk, false, [window.SKILLS.Attack]),
    new Character(2, 'Ben', CONFIG.defaultHp, CONFIG.defaultAtk, false, [window.SKILLS.Attack])
  ],
  turnIndex: 0,
  gameOver: false
};

let leftPanel, logWindow, targetButtons, controlsText;
let gameContainer, overlayCanvas, overlayCtx;
let selectionMode = false;
let selectedSkill = null;

// 游戏启动：获取 DOM、渲染初始角色卡片，并进入首轮处理
function start() {
  leftPanel = document.getElementById('left-panel');
  logWindow = document.getElementById('log-window');
  targetButtons = document.getElementById('target-buttons');
  controlsText = document.querySelector('#controls p');
  gameContainer = document.getElementById('game-container');
  overlayCanvas = document.getElementById('arrow-layer');
  if (overlayCanvas && gameContainer) {
    resizeOverlay();
    window.addEventListener('resize', resizeOverlay);
    overlayCtx = overlayCanvas.getContext('2d');
  }
  leftPanel.addEventListener('click', onLeftPanelClick);
  leftPanel.addEventListener('mousemove', onLeftPanelMouseMove);
  leftPanel.addEventListener('mouseleave', clearArrow);
  renderCharacters();
  processTurn();
}

// 首次进入由按钮触发；不存在按钮时直接开始
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-button');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startBtn.disabled = true;
      startBtn.style.display = 'none';
      start();
    });
  } else {
    start();
  }
});

// 渲染左侧角色列表：展示名称、血量、当前回合高亮以及死亡标记
function renderCharacters() {
  leftPanel.innerHTML = '';
  state.characters.forEach((char, index) => {
    const card = document.createElement('div');
    card.className = `character-card ${char.isPlayer ? 'player' : 'enemy'} ${char.isDead ? 'dead' : ''} ${index === state.turnIndex ? 'active' : ''}`;
    card.dataset.id = String(char.id);
    if (selectionMode && !char.isPlayer && !char.isDead) {
      card.classList.add('clickable');
    }
    const hpPercent = (char.hp / char.maxHp) * 100;
    const hpColorClass = hpPercent < 30 ? 'low' : ''; 
    card.innerHTML =
      `<div class="char-info">
        <span class="char-name">${char.name}</span>
        <span class="char-hp">HP: ${char.hp} / ${char.maxHp}</span>
        <span class="char-atk">Atk: ${char.atk}</span>
        <div class="hp-bar-container">
          <div class="hp-bar-fill ${hpColorClass}" style="width: ${hpPercent}%"></div>
        </div>
      </div>${char.isDead ? '<span>💀</span>' : ''}`;
    leftPanel.appendChild(card);
  });
}

// 记录战斗日志：追加文本并滚动到底部，且等待一段时间
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function log(message) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = message;
  logWindow.appendChild(entry);
  logWindow.scrollTop = logWindow.scrollHeight;
  renderCharacters(); // 刷新界面以反映最新状态
  await wait(500); // 每次日志后等待500毫秒
}

// 处理当前回合：若死亡则跳过；玩家则启用操作，敌人则执行AI
async function processTurn() {
  if (checkGameOver()) return;
  const currentChar = state.characters[state.turnIndex];
  if (currentChar.isDead) { nextTurn(); return; }
  renderCharacters();
  if (currentChar.isPlayer) {
    await log(`👉 轮到 ${currentChar.name} 行动了。`);
    enablePlayerControls();
  } else {
    await log(`Wait 轮到 ${currentChar.name} 行动...`);
    disablePlayerControls();
    await enemyAI(currentChar);
  }
}

// 切换到下一个角色的回合，形成环形队列
function nextTurn() {
  state.turnIndex = (state.turnIndex + 1) % state.characters.length;
  processTurn();
}

// 玩家操作面板：根据存活敌人生成“攻击”按钮
function enablePlayerControls() {
  targetButtons.innerHTML = '';
  controlsText.textContent = '选择行动：';
  const currentChar = state.characters[state.turnIndex];
  
  // 遍历当前角色的技能池
  if (currentChar.skills && currentChar.skills.length > 0) {
    currentChar.skills.forEach(skill => {
      const btn = document.createElement('button');
      btn.textContent = skill.name;
      btn.title = skill.description;
      btn.onclick = () => {
        if (skill.isTargeted) {
          enterTargetSelection(skill);
        } else {
          performSkill(currentChar, null, skill);
        }
      };
      targetButtons.appendChild(btn);
    });
  } else {
    // 默认 fallback
    const btn = document.createElement('button');
    btn.textContent = '攻击';
    btn.onclick = () => enterTargetSelection(window.SKILLS.Attack);
    targetButtons.appendChild(btn);
  }
}

// 禁用玩家操作面板（敌人行动或战斗结束）
function disablePlayerControls() {
  targetButtons.innerHTML = '';
  controlsText.textContent = '敌方行动中...';
  exitTargetSelection();
}

// 敌人AI：选择一个存活的玩家目标并发起攻击；若无目标则跳过
async function enemyAI(attacker) {
  const targets = state.characters.filter(c => c.isPlayer && !c.isDead);
  if (targets.length > 0) {
    // 随机选择目标
    const target = targets[Math.floor(Math.random() * targets.length)];
    // 随机选择技能 (目前只有 Attack)
    let skill = window.SKILLS.Attack;
    if (attacker.skills && attacker.skills.length > 0) {
      skill = attacker.skills[Math.floor(Math.random() * attacker.skills.length)];
    }
    
    await performSkill(attacker, target, skill);
  } else {
    await log(`${attacker.name} 茫然四顾，找不到目标。`);
    nextTurn();
  }
}

// 执行技能
async function performSkill(attacker, target, skill) {
  // 传入回调用于记录日志
  await skill.execute(attacker, target, {
    onLog: async (msg) => await log(msg),
    getCharacters: () => state.characters
  });
  
  renderCharacters();
  if (!checkGameOver()) nextTurn();
}

// (旧的 performAttack 已被废弃，用 performSkill 替代，但为了兼容性或防止漏改，可暂时保留或直接删除)
function performAttack(attacker, target) {
  performSkill(attacker, target, window.SKILLS.Attack);
}

// 胜负判定：玩家或敌人一方全灭则结束战斗
function checkGameOver() {
  const playersAlive = state.characters.some(c => c.isPlayer && !c.isDead);
  const enemiesAlive = state.characters.some(c => !c.isPlayer && !c.isDead);
  if (!playersAlive) {
    log('❌ 游戏结束，你失败了！');
    state.gameOver = true;
    disablePlayerControls();
    controlsText.textContent = '游戏结束。';
    return true;
  }
  if (!enemiesAlive) {
    log('🏆 游戏结束，你胜利了！');
    state.gameOver = true;
    disablePlayerControls();
    controlsText.textContent = '胜利！';
    return true;
  }
  return false;
}

function enterTargetSelection(skill) {
  selectionMode = true;
  selectedSkill = skill || window.SKILLS.Attack;
  controlsText.textContent = `[${selectedSkill.name}] 请点击左侧敌人执行：`;
  renderCharacters();

  // 禁用所有技能按钮
  const skillButtons = targetButtons.querySelectorAll('button');
  skillButtons.forEach(btn => btn.disabled = true);

  // 添加撤销按钮
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '撤销';
  cancelBtn.onclick = () => {
    exitTargetSelection();
    enablePlayerControls();
  };
  targetButtons.appendChild(cancelBtn);
}

function exitTargetSelection() {
  if (!selectionMode) return;
  selectionMode = false;
  selectedSkill = null;
  clearArrow();
  renderCharacters();
}

function onLeftPanelClick(e) {
  if (!selectionMode) return;
  const card = e.target.closest('.character-card');
  if (!card) return;
  const id = Number(card.dataset.id);
  const target = state.characters.find(c => c.id === id);
  const attacker = state.characters[state.turnIndex];
  if (!target || target.isPlayer || target.isDead) return;
  
  // 使用当前选择的技能执行
  performSkill(attacker, target, selectedSkill || window.SKILLS.Attack);
  
  exitTargetSelection();
}

function onLeftPanelMouseMove(e) {
  if (!selectionMode || !overlayCtx) return;
  const card = e.target.closest('.character-card');
  if (!card || card.classList.contains('player') || card.classList.contains('dead')) {
    clearArrow();
    return;
  }
  const playerCard = leftPanel.querySelector('.character-card.player');
  if (!playerCard) return;
  drawArrowBetween(playerCard, card);
}

function resizeOverlay() {
  if (!overlayCanvas || !gameContainer) return;
  const rect = gameContainer.getBoundingClientRect();
  overlayCanvas.width = Math.round(rect.width);
  overlayCanvas.height = Math.round(rect.height);
}

function clearArrow() {
  if (!overlayCtx || !overlayCanvas) return;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function drawArrowBetween(startCard, targetCard) {
  if (!overlayCtx || !gameContainer) return;
  clearArrow();
  const contRect = gameContainer.getBoundingClientRect();
  const sRect = startCard.getBoundingClientRect();
  const tRect = targetCard.getBoundingClientRect();
  const offset = 4;
  const sX = (sRect.left - contRect.left) - offset;
  const sY = ((sRect.top + sRect.bottom) / 2) - contRect.top;
  const tX = (tRect.left - contRect.left) - offset;
  const tY = ((tRect.top + tRect.bottom) / 2) - contRect.top;
  const leftArc = 40;
  const c1X = sX - leftArc;
  const c1Y = sY;
  const c2X = tX - leftArc;
  const c2Y = tY;
  overlayCtx.strokeStyle = '#339af0';
  overlayCtx.lineWidth = 6;
  overlayCtx.beginPath();
  overlayCtx.moveTo(sX, sY);
  overlayCtx.bezierCurveTo(c1X, c1Y, c2X, c2Y, tX, tY);
  overlayCtx.stroke();
  const angle = Math.atan2(tY - c2Y, tX - c2X);
  const headLen = 14;
  overlayCtx.beginPath();
  overlayCtx.moveTo(tX, tY);
  overlayCtx.lineTo(tX - headLen * Math.cos(angle - Math.PI / 6), tY - headLen * Math.sin(angle - Math.PI / 6));
  overlayCtx.lineTo(tX - headLen * Math.cos(angle + Math.PI / 6), tY - headLen * Math.sin(angle + Math.PI / 6));
  overlayCtx.lineTo(tX, tY);
  overlayCtx.fillStyle = '#339af0';
  overlayCtx.fill();
}
