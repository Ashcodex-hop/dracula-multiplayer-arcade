// 1v1 Tug-of-War Button-Mashing Engine

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  const myRole = urlParams.get('role') || 'P1';
  const myName = decodeURIComponent(urlParams.get('name') || 'Player');

  const socket = window.parent.getArcadeSocket ? window.parent.getArcadeSocket() : null;

  // DOM Elements
  const canvas = document.getElementById('rope-canvas');
  const ctx = canvas.getContext('2d');
  const winnerBanner = document.getElementById('winner-banner');
  const roleTag = document.getElementById('role-tag');
  const pullBtn = document.getElementById('pull-btn');
  const surgeBtn = document.getElementById('surge-btn');
  const surgeFill = document.getElementById('surge-fill');

  roleTag.textContent = `YOU ARE: ${myRole === 'P1' ? 'P1 (LEFT)' : 'P2 (RIGHT)'}`;

  // Canvas State
  const WIDTH = 820;
  const HEIGHT = 240;
  let targetRopePos = 50; // 0 to 100
  let currentRopePos = 50;
  let surgeVal = 0;
  let gameOver = false;

  // Pull Actions
  function executePull() {
    if (gameOver) return;

    if (window.soundEngine) window.soundEngine.playClick();

    // Increment surge meter
    surgeVal = Math.min(100, surgeVal + 7);
    updateSurgeMeter();

    if (socket) {
      socket.emit('tug-mash-pull', {
        role: myRole,
        force: 1.6
      });
    } else {
      // Local fallback test
      if (myRole === 'P1') targetRopePos = Math.max(0, targetRopePos - 2);
      else targetRopePos = Math.min(100, targetRopePos + 2);
    }
  }

  function executeSurge() {
    if (gameOver || surgeVal < 100) return;

    surgeVal = 0;
    updateSurgeMeter();
    if (window.soundEngine) window.soundEngine.playLaser();

    if (socket) {
      socket.emit('tug-special-surge', {
        role: myRole,
        force: 8.0
      });
    }
  }

  function updateSurgeMeter() {
    surgeFill.style.width = `${surgeVal}%`;
    surgeBtn.disabled = (surgeVal < 100);
  }

  pullBtn.addEventListener('click', executePull);
  surgeBtn.addEventListener('click', executeSurge);

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'a' || e.key === 'd') {
      executePull();
    }
  });

  // Socket Listeners
  if (socket) {
    socket.on('tug-state-sync', (data) => {
      targetRopePos = data.ropePos;

      if (data.winner) {
        gameOver = true;
        pullBtn.disabled = true;
        surgeBtn.disabled = true;

        if (data.winner === myRole) {
          winnerBanner.textContent = '🏆 VICTORY! YOU PULLED OPPONENT IN!';
          winnerBanner.style.color = '#00ff66';
          if (window.soundEngine) window.soundEngine.playVictory();
        } else {
          winnerBanner.textContent = '💀 DEFEAT! PULLED INTO THE PIT!';
          winnerBanner.style.color = '#ff0055';
        }
      }
    });

    socket.on('tug-surge-effect', (data) => {
      targetRopePos = data.ropePos;
      if (window.soundEngine) window.soundEngine.playLaser();
    });
  }

  // Render Loop
  function render() {
    // Smooth interpolation
    currentRopePos += (targetRopePos - currentRopePos) * 0.15;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Left & Right Zone Danger Pits
    ctx.fillStyle = 'rgba(255, 0, 85, 0.15)';
    ctx.fillRect(0, 0, 80, HEIGHT);
    ctx.fillRect(WIDTH - 80, 0, 80, HEIGHT);

    // Pit Boundary Lines
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 0); ctx.lineTo(80, HEIGHT);
    ctx.moveTo(WIDTH - 80, 0); ctx.lineTo(WIDTH - 80, HEIGHT);
    ctx.stroke();

    // Center Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0); ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate Rope Nodes
    const p1AnchorX = 70;
    const p2AnchorX = WIDTH - 70;
    const centerY = HEIGHT / 2;

    const markerX = 80 + (currentRopePos / 100) * (WIDTH - 160);

    // Draw Main Rope Line
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 10;
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(p1AnchorX, centerY);
    // Quadratic Curve to simulate tension strain
    ctx.quadraticCurveTo(markerX, centerY + 10, p2AnchorX, centerY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw Center Flag / Marker Knot
    ctx.fillStyle = '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(markerX, centerY + 5, 18, 0, Math.PI * 2);
    ctx.fill();

    // Draw P1 & P2 Player Figures
    ctx.shadowBlur = 0;
    ctx.font = '2.5rem serif';
    ctx.fillText('🏃‍♂️', p1AnchorX - 40, centerY + 15);
    ctx.fillText('🏃‍♀️', p2AnchorX + 5, centerY + 15);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
