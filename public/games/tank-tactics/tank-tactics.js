// Tank Tactics — Turn-Based Grid Battler Engine

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  const myRole = urlParams.get('role') || 'P1';
  const myName = decodeURIComponent(urlParams.get('name') || 'Player');

  const socket = window.parent.getArcadeSocket ? window.parent.getArcadeSocket() : null;

  // DOM Elements
  const turnBanner = document.getElementById('turn-banner');
  const tanksAliveCount = document.getElementById('tanks-alive-count');
  const myGridEl = document.getElementById('my-grid');
  const targetGridEl = document.getElementById('target-grid');
  const btnRotate = document.getElementById('btn-rotate-tank');
  const btnLock = document.getElementById('btn-lock-fleet');
  const btnRadar = document.getElementById('btn-radar');

  // Game State
  const GRID_SIZE = 10;
  const TANKS_CONFIG = [
    { name: 'Heavy Tank', size: 3, symbol: '🚜' },
    { name: 'Medium Tank', size: 2, symbol: '🚘' },
    { name: 'Scout Jeep', size: 1, symbol: '🏎️' }
  ];

  let currentPlacementIdx = 0;
  let isHorizontal = true;
  let placementLocked = false;
  let isMyTurn = false;
  let radarUses = 1;

  // Grid Matrices (10x10)
  // myMatrix: 0 = empty, 1..3 = tank ID
  const myMatrix = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
  const myHitsMatrix = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0)); // 1 = hit, -1 = miss
  const targetHitsMatrix = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));

  // Initialize Grids
  initBoard(myGridEl, true);
  initBoard(targetGridEl, false);

  function initBoard(el, isMyBoard) {
    el.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        if (isMyBoard) {
          cell.addEventListener('mouseenter', () => handleCellHover(r, c));
          cell.addEventListener('mouseleave', clearHover);
          cell.addEventListener('click', () => handleCellPlacement(r, c));
        } else {
          cell.addEventListener('click', () => handleTargetStrike(r, c));
        }
        el.appendChild(cell);
      }
    }
  }

  // Placement Logic
  btnRotate.addEventListener('click', () => {
    isHorizontal = !isHorizontal;
    btnRotate.textContent = `🔄 ROTATE: ${isHorizontal ? 'HORIZ' : 'VERT'}`;
    if (window.soundEngine) window.soundEngine.playClick();
  });

  function handleCellHover(r, c) {
    if (placementLocked || currentPlacementIdx >= TANKS_CONFIG.length) return;
    clearHover();
    const tank = TANKS_CONFIG[currentPlacementIdx];
    const valid = canPlaceTank(r, c, tank.size, isHorizontal);

    for (let i = 0; i < tank.size; i++) {
      const tr = r + (isHorizontal ? 0 : i);
      const tc = c + (isHorizontal ? i : 0);
      if (tr < GRID_SIZE && tc < GRID_SIZE) {
        const cell = myGridEl.querySelector(`[data-r="${tr}"][data-c="${tc}"]`);
        if (cell) {
          cell.style.background = valid ? 'rgba(0, 255, 102, 0.4)' : 'rgba(255, 0, 85, 0.4)';
        }
      }
    }
  }

  function clearHover() {
    if (placementLocked) return;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = myGridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if (cell && !myMatrix[r][c]) {
          cell.style.background = '#0c1824';
        }
      }
    }
  }

  function canPlaceTank(r, c, size, horiz) {
    for (let i = 0; i < size; i++) {
      const tr = r + (horiz ? 0 : i);
      const tc = c + (horiz ? i : 0);
      if (tr >= GRID_SIZE || tc >= GRID_SIZE || myMatrix[tr][tc] !== 0) {
        return false;
      }
    }
    return true;
  }

  function handleCellPlacement(r, c) {
    if (placementLocked || currentPlacementIdx >= TANKS_CONFIG.length) return;
    const tank = TANKS_CONFIG[currentPlacementIdx];

    if (canPlaceTank(r, c, tank.size, isHorizontal)) {
      for (let i = 0; i < tank.size; i++) {
        const tr = r + (isHorizontal ? 0 : i);
        const tc = c + (isHorizontal ? i : 0);
        myMatrix[tr][tc] = currentPlacementIdx + 1; // tank ID
        const cell = myGridEl.querySelector(`[data-r="${tr}"][data-c="${tc}"]`);
        if (cell) {
          cell.classList.add('tank');
          cell.textContent = tank.symbol;
        }
      }

      currentPlacementIdx++;
      if (window.soundEngine) window.soundEngine.playClick();

      if (currentPlacementIdx >= TANKS_CONFIG.length) {
        btnLock.disabled = false;
        turnBanner.textContent = 'FLEET PLACED! CLICK LOCK';
      }
    }
  }

  btnLock.addEventListener('click', () => {
    placementLocked = true;
    btnLock.disabled = true;
    btnRotate.disabled = true;
    turnBanner.textContent = 'WAITING FOR OPPONENT...';

    if (socket) {
      socket.emit('tank-submit-fleet', {
        role: myRole,
        fleetGrid: myMatrix
      });
    } else {
      // Local fallback test
      startBattle('P1');
    }
  });

  function startBattle(firstTurn) {
    isMyTurn = (firstTurn === myRole);
    updateTurnUI();
  }

  function updateTurnUI() {
    if (isMyTurn) {
      turnBanner.textContent = 'YOUR TURN! ATTACK ENEMY GRID';
      turnBanner.style.borderColor = '#00ff66';
      turnBanner.style.color = '#00ff66';
    } else {
      turnBanner.textContent = "OPPONENT'S TURN... INCOMING!";
      turnBanner.style.borderColor = '#ff0055';
      turnBanner.style.color = '#ff0055';
    }
  }

  // Strike Action Logic
  function handleTargetStrike(r, c) {
    if (!placementLocked || !isMyTurn) return;
    if (targetHitsMatrix[r][c] !== 0) return; // already fired here

    targetHitsMatrix[r][c] = 1; // pending

    if (socket) {
      socket.emit('tank-fire-strike', {
        attackerRole: myRole,
        x: c,
        y: r
      });
      isMyTurn = false;
      turnBanner.textContent = 'SHELL FIRED... WAITING FOR IMPACT';
    }
  }

  // Socket Handlers
  if (socket) {
    socket.on('tank-battle-start', (data) => {
      if (window.soundEngine) window.soundEngine.playJoin();
      startBattle(data.currentTurn);
    });

    socket.on('tank-incoming-strike', (data) => {
      const r = data.y;
      const c = data.x;
      const hit = (myMatrix[r][c] > 0);
      myHitsMatrix[r][c] = hit ? 1 : -1;

      // Render on My Grid
      const cell = myGridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      if (cell) {
        if (hit) {
          cell.classList.add('hit');
          cell.textContent = '💥';
          if (window.soundEngine) window.soundEngine.playExplosion();
        } else {
          cell.classList.add('miss');
          cell.textContent = '🌊';
          if (window.soundEngine) window.soundEngine.playClick();
        }
      }

      // Check if all tanks destroyed
      let totalTankCells = 0;
      let totalHitCells = 0;
      for (let tr = 0; tr < GRID_SIZE; tr++) {
        for (let tc = 0; tc < GRID_SIZE; tc++) {
          if (myMatrix[tr][tc] > 0) {
            totalTankCells++;
            if (myHitsMatrix[tr][tc] === 1) totalHitCells++;
          }
        }
      }

      const allDestroyed = (totalTankCells > 0 && totalHitCells >= totalTankCells);

      socket.emit('tank-strike-result', {
        attackerRole: data.attackerRole,
        x: c,
        y: r,
        hit,
        allDestroyed
      });
    });

    socket.on('tank-strike-resolved', (data) => {
      if (data.attackerRole === myRole) {
        const cell = targetGridEl.querySelector(`[data-r="${data.y}"][data-c="${data.x}"]`);
        if (cell) {
          if (data.hit) {
            cell.classList.add('hit');
            cell.textContent = '💥';
            if (window.soundEngine) window.soundEngine.playExplosion();
          } else {
            cell.classList.add('miss');
            cell.textContent = '🌊';
            if (window.soundEngine) window.soundEngine.playClick();
          }
        }
      }

      if (data.allDestroyed) {
        if (data.attackerRole === myRole) {
          turnBanner.textContent = '🏆 VICTORY! ALL ENEMY TANKS DESTROYED!';
          if (window.soundEngine) window.soundEngine.playVictory();
        } else {
          turnBanner.textContent = '💀 DEFEAT! YOUR FLEET WAS ELIMINATED!';
        }
        isMyTurn = false;
        return;
      }

      isMyTurn = (data.nextTurn === myRole);
      updateTurnUI();
    });
  }
})();
