// Co-op Laser Maze Defusal Engine

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  const myRole = urlParams.get('role') || 'P1';
  const myName = decodeURIComponent(urlParams.get('name') || 'Player');

  const socket = window.parent.getArcadeSocket ? window.parent.getArcadeSocket() : null;

  // DOM Elements
  const roleTitle = document.getElementById('role-title');
  const defuseTimer = document.getElementById('defuse-timer');
  const fieldView = document.getElementById('field-agent-view');
  const operatorView = document.getElementById('operator-view');
  const canvas = document.getElementById('maze-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  // Operator DOM
  const toggleLaserA = document.getElementById('toggle-laser-a');
  const toggleLaserB = document.getElementById('toggle-laser-b');
  const toggleLaserC = document.getElementById('toggle-laser-c');
  const defuseCodeDisplay = document.getElementById('defuse-code-display');
  const defuseCodeInput = document.getElementById('defuse-code-input');
  const submitDefuseBtn = document.getElementById('submit-defuse-btn');

  // Game Constants & State
  let isAgent = (myRole === 'P1');
  let timeLeft = 120; // 2 minutes
  let secretCode = ['7', '4', '9'];
  let revealedDigits = ['_', '_', '_'];

  // Laser Node Active States
  const laserStates = {
    A: true,
    B: true,
    C: true
  };

  // Agent Maze Map (15 columns x 10 rows, grid 40px)
  const TILE_SIZE = 40;
  const agentPos = { r: 1, c: 1 };

  // Keycards in Maze
  const keycards = [
    { r: 2, c: 12, digit: secretCode[0], collected: false },
    { r: 7, c: 2,  digit: secretCode[1], collected: false },
    { r: 8, c: 12, digit: secretCode[2], collected: false }
  ];

  // Bomb Core
  const bombPos = { r: 5, c: 13 };

  // Setup View according to Role
  if (isAgent) {
    roleTitle.textContent = `ROLE: FIELD AGENT (${myName})`;
    fieldView.style.display = 'flex';
    operatorView.style.display = 'none';
  } else {
    roleTitle.textContent = `ROLE: HACKER OPERATOR (${myName})`;
    fieldView.style.display = 'none';
    operatorView.style.display = 'flex';
  }

  // Timer Loop
  const timerInterval = setInterval(() => {
    timeLeft--;
    const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    defuseTimer.textContent = `${mins}:${secs}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      defuseTimer.textContent = 'BOOM! 💥';
      alert('TIME EXPIRED! BOMB DETONATED! GAME OVER!');
    }
  }, 1000);

  // ==================== FIELD AGENT CONTROLS & MAZE RENDER ====================
  function moveAgent(dr, dc) {
    if (!isAgent) return;
    const newR = agentPos.r + dr;
    const newC = agentPos.c + dc;

    // Check bounds (0 to 14 col, 0 to 9 row)
    if (newR < 0 || newR >= 10 || newC < 0 || newC >= 15) return;

    // Check Walls
    if (isWall(newR, newC)) return;

    // Check Active Laser Beams
    if (isLaserActiveAt(newR, newC)) {
      if (window.soundEngine) window.soundEngine.playLaser();
      alert('🚨 TRIPPED SECURITY LASER! RESETTING TO START!');
      agentPos.r = 1;
      agentPos.c = 1;
      return;
    }

    agentPos.r = newR;
    agentPos.c = newC;
    if (window.soundEngine) window.soundEngine.playClick();

    // Check Keycard Pickup
    keycards.forEach((k, idx) => {
      if (!k.collected && k.r === agentPos.r && k.c === agentPos.c) {
        k.collected = true;
        if (window.soundEngine) window.soundEngine.playScore();

        if (socket) {
          socket.emit('laser-key-found', {
            keyIdx: idx,
            digit: k.digit
          });
        }
      }
    });

    // Broadcast Agent position
    if (socket) {
      socket.emit('laser-agent-sync', { r: agentPos.r, c: agentPos.c });
    }
  }

  function isWall(r, c) {
    // Outer border walls
    if (r === 0 || r === 9 || c === 0 || c === 14) return true;
    // Internal obstacles
    if (r === 3 && c >= 2 && c <= 10) return true;
    if (r === 6 && c >= 4 && c <= 12) return true;
    return false;
  }

  function isLaserActiveAt(r, c) {
    if (laserStates.A && c === 4 && r >= 1 && r <= 2) return true;
    if (laserStates.B && c === 8 && r >= 4 && r <= 5) return true;
    if (laserStates.C && c === 11 && r >= 7 && r <= 8) return true;
    return false;
  }

  // Keyboard Listeners
  window.addEventListener('keydown', (e) => {
    if (!isAgent) return;
    if (e.key === 'ArrowUp' || e.key === 'w') moveAgent(-1, 0);
    if (e.key === 'ArrowDown' || e.key === 's') moveAgent(1, 0);
    if (e.key === 'ArrowLeft' || e.key === 'a') moveAgent(0, -1);
    if (e.key === 'ArrowRight' || e.key === 'd') moveAgent(0, 1);
  });

  // D-Pad Listeners
  const btnUp = document.getElementById('btn-up');
  const btnDown = document.getElementById('btn-down');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');

  if (btnUp) btnUp.addEventListener('click', () => moveAgent(-1, 0));
  if (btnDown) btnDown.addEventListener('click', () => moveAgent(1, 0));
  if (btnLeft) btnLeft.addEventListener('click', () => moveAgent(0, -1));
  if (btnRight) btnRight.addEventListener('click', () => moveAgent(0, 1));

  // Render Maze (for Agent)
  function renderMaze() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 15; c++) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (isWall(r, c)) {
          ctx.fillStyle = '#1c1c38';
          ctx.fillRect(x, y, TILE_SIZE - 2, TILE_SIZE - 2);
        } else {
          ctx.fillStyle = '#0c0c20';
          ctx.fillRect(x, y, TILE_SIZE - 2, TILE_SIZE - 2);
        }
      }
    }

    // Render Laser Beams
    drawLaserBeam(4, 1, 4, 2, laserStates.A, 'A');
    drawLaserBeam(8, 4, 8, 5, laserStates.B, 'B');
    drawLaserBeam(11, 7, 11, 8, laserStates.C, 'C');

    // Render Keycards
    keycards.forEach(k => {
      if (!k.collected) {
        ctx.font = '1.3rem serif';
        ctx.fillText('🔑', k.c * TILE_SIZE + 6, k.r * TILE_SIZE + 30);
      }
    });

    // Render Bomb Core
    ctx.font = '1.5rem serif';
    ctx.fillText('💣', bombPos.c * TILE_SIZE + 5, bombPos.r * TILE_SIZE + 32);

    // Render Field Agent
    ctx.shadowColor = '#9d00ff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#9d00ff';
    ctx.beginPath();
    ctx.arc(agentPos.c * TILE_SIZE + 20, agentPos.r * TILE_SIZE + 20, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    requestAnimationFrame(renderMaze);
  }

  function drawLaserBeam(c1, r1, c2, r2, active, label) {
    if (!active) return;
    ctx.strokeStyle = '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 15;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(c1 * TILE_SIZE + 20, r1 * TILE_SIZE + 5);
    ctx.lineTo(c2 * TILE_SIZE + 20, r2 * TILE_SIZE + 35);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (isAgent) requestAnimationFrame(renderMaze);

  // ==================== OPERATOR CONTROLS ====================
  function toggleLaserNode(node, btnEl) {
    laserStates[node] = !laserStates[node];
    btnEl.textContent = `NODE ${node}: ${laserStates[node] ? 'ACTIVE' : 'OFF'}`;
    btnEl.className = `btn-toggle-laser ${laserStates[node] ? '' : 'off'}`;
    if (window.soundEngine) window.soundEngine.playClick();

    if (socket) {
      socket.emit('laser-operator-toggle', {
        node,
        state: laserStates[node]
      });
    }
  }

  if (toggleLaserA) toggleLaserA.addEventListener('click', () => toggleLaserNode('A', toggleLaserA));
  if (toggleLaserB) toggleLaserB.addEventListener('click', () => toggleLaserNode('B', toggleLaserB));
  if (toggleLaserC) toggleLaserC.addEventListener('click', () => toggleLaserNode('C', toggleLaserC));

  if (submitDefuseBtn) {
    submitDefuseBtn.addEventListener('click', () => {
      const codeInput = (defuseCodeInput.value || '').trim();
      const targetCode = secretCode.join('');

      if (codeInput === targetCode) {
        clearInterval(timerInterval);
        alert('🏆 BOMB DEFUSED! TEAM VICTORY!');
        if (window.soundEngine) window.soundEngine.playVictory();

        if (socket) {
          socket.emit('laser-defuse-code', { success: true });
        }
      } else {
        alert('❌ WRONG DEFUSAL CODE! DETONATION IMMINENT!');
        if (window.soundEngine) window.soundEngine.playExplosion();
      }
    });
  }

  // Socket Listeners
  if (socket) {
    socket.on('laser-trap-toggled', (data) => {
      laserStates[data.node] = data.state;
    });

    socket.on('laser-key-revealed', (data) => {
      revealedDigits[data.keyIdx] = data.digit;
      defuseCodeDisplay.textContent = revealedDigits.join(' ');
      if (window.soundEngine) window.soundEngine.playScore();
    });

    socket.on('laser-defuse-result', (data) => {
      if (data.success) {
        clearInterval(timerInterval);
        alert('🏆 BOMB DEFUSED! TEAM VICTORY!');
        if (window.soundEngine) window.soundEngine.playVictory();
      }
    });
  }
})();
