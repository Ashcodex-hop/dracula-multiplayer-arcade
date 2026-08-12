// Type-Shooter — ZType Typing Arcade Engine

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const theme = urlParams.get('theme') || localStorage.getItem('neon_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  // DOM Elements
  const canvas = document.getElementById('shooter-canvas');
  const ctx = canvas.getContext('2d');
  const hudScore = document.getElementById('hud-score');
  const hudWpm = document.getElementById('hud-wpm');
  const hudAccuracy = document.getElementById('hud-accuracy');
  const hudShield = document.getElementById('hud-shield');

  const resultsModal = document.getElementById('results-modal');
  const resRank = document.getElementById('res-rank');
  const resWpm = document.getElementById('res-wpm');
  const resAccuracy = document.getElementById('res-accuracy');
  const resShips = document.getElementById('res-ships');
  const resScore = document.getElementById('res-score');
  const btnRestart = document.getElementById('btn-restart-game');

  // Word Dictionary Bank
  const WORDS_SHORT = [
    'NODE', 'CODE', 'DATA', 'SYNC', 'PING', 'LINK', 'BYTE', 'PORT',
    'FIRE', 'LASER', 'PONG', 'MAZE', 'TANK', 'SHIP', 'STAR', 'GRID'
  ];
  const WORDS_MEDIUM = [
    'ARCADE', 'SOCKET', 'PORTAL', 'CYBER', 'MATRIX', 'VECTOR', 'SYSTEM',
    'SHIELD', 'ROCKET', 'PIRATE', 'ROBOTS', 'PLASMA', 'DASH', 'ACTION'
  ];
  const WORDS_LONG = [
    'MULTIPLAYER', 'NEONLIGHTS', 'HACKATHON', 'PROTOTYPE', 'FULLSTACK',
    'JAVASCRIPT', 'CYBERPUNK', 'SUPERNOVA', 'TELEMETRY', 'SPACESHIP'
  ];

  // Game Dimensions & Constants
  const WIDTH = 850;
  const HEIGHT = 520;
  const PLAYER_POS = { x: WIDTH / 2, y: HEIGHT - 40 };

  // Engine State
  let gameActive = true;
  let score = 0;
  let shield = 100;
  let wave = 1;
  let spawnTimer = 0;
  let spawnInterval = 140; // frames

  let ships = [];
  let plasmaBolts = [];
  let particles = [];
  let targetShip = null;
  let shakeTime = 0;

  // Telemetry Metrics
  let startTime = Date.now();
  let totalKeystrokes = 0;
  let correctKeystrokes = 0;
  let destroyedCount = 0;

  // Spawner Logic
  function spawnEnemyShip() {
    let wordList = WORDS_SHORT;
    if (wave > 2) wordList = [...WORDS_SHORT, ...WORDS_MEDIUM];
    if (wave > 4) wordList = [...WORDS_SHORT, ...WORDS_MEDIUM, ...WORDS_LONG];

    const word = wordList[Math.floor(Math.random() * wordList.length)];
    const x = 60 + Math.random() * (WIDTH - 120);

    const ship = {
      id: Math.random().toString(),
      x,
      y: -30,
      vy: 0.6 + Math.min(2.0, wave * 0.12),
      word,
      typedLength: 0,
      color: getRandomNeonColor()
    };
    ships.push(ship);
  }

  function getRandomNeonColor() {
    const colors = ['#00f3ff', '#ff0055', '#9d00ff', '#00ff66', '#ffcc00'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Keyboard Event Matcher
  window.addEventListener('keydown', (e) => {
    if (!gameActive) return;

    const key = e.key.toUpperCase();
    if (key.length !== 1 || key < 'A' || key > 'Z') return;

    totalKeystrokes++;

    // Lock target if not locked
    if (!targetShip) {
      // Find ship whose remaining word starts with key
      const match = ships.find(s => s.word[s.typedLength] === key);
      if (match) {
        targetShip = match;
        processMatchedKey(key);
      } else {
        if (window.soundEngine) window.soundEngine.playClick();
      }
    } else {
      // Locked onto a ship
      const expectedChar = targetShip.word[targetShip.typedLength];
      if (key === expectedChar) {
        processMatchedKey(key);
      } else {
        if (window.soundEngine) window.soundEngine.playClick();
      }
    }
  });

  function processMatchedKey(key) {
    correctKeystrokes++;
    targetShip.typedLength++;

    // Spawn plasma laser bolt
    plasmaBolts.push({
      x: PLAYER_POS.x,
      y: PLAYER_POS.y,
      targetX: targetShip.x,
      targetY: targetShip.y,
      color: targetShip.color,
      progress: 0
    });

    if (window.soundEngine) {
      window.soundEngine.playTypeClick();
      window.soundEngine.playLaserShot();
    }

    // Check if word complete
    if (targetShip.typedLength >= targetShip.word.length) {
      destroyShip(targetShip);
      targetShip = null;
    }

    updateTelemetryHUD();
  }

  function destroyShip(ship) {
    score += ship.word.length * 60;
    destroyedCount++;
    shakeTime = 12; // Trigger screen shake

    createParticleExplosion(ship.x, ship.y, ship.color);
    if (window.soundEngine) window.soundEngine.playHeavyExplosion();

    // Remove ship from array
    ships = ships.filter(s => s.id !== ship.id);

    // Increase wave progression
    if (destroyedCount % 5 === 0) wave++;
  }

  function createParticleExplosion(x, y, color) {
    for (let i = 0; i < 35; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 1.0,
        color,
        size: 3 + Math.random() * 5
      });
    }
  }

  function updateTelemetryHUD() {
    const elapsedMins = Math.max(0.01, (Date.now() - startTime) / 60000);
    const liveWpm = Math.round((correctKeystrokes / 5) / elapsedMins);
    const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 100;

    hudScore.textContent = score;
    hudWpm.textContent = `${liveWpm} WPM`;
    hudAccuracy.textContent = `${accuracy}%`;
    hudShield.textContent = `${Math.max(0, shield)}%`;
  }

  // Restart Handler
  btnRestart.addEventListener('click', () => {
    resultsModal.classList.remove('active');
    resetGame();
  });

  function resetGame() {
    gameActive = true;
    score = 0;
    shield = 100;
    wave = 1;
    spawnTimer = 0;
    ships = [];
    plasmaBolts = [];
    particles = [];
    targetShip = null;
    startTime = Date.now();
    totalKeystrokes = 0;
    correctKeystrokes = 0;
    destroyedCount = 0;
    updateTelemetryHUD();
  }

  function triggerGameOver() {
    gameActive = false;

    const elapsedMins = Math.max(0.01, (Date.now() - startTime) / 60000);
    const finalWpm = Math.round((correctKeystrokes / 5) / elapsedMins);
    const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 100;

    // Calculate Rank
    let rank = 'D';
    if (finalWpm > 70 && accuracy > 92) rank = 'S';
    else if (finalWpm > 50 && accuracy > 85) rank = 'A';
    else if (finalWpm > 35) rank = 'B';
    else if (finalWpm > 20) rank = 'C';

    resRank.textContent = `RANK ${rank}`;
    resWpm.textContent = `${finalWpm} WPM`;
    resAccuracy.textContent = `${accuracy}%`;
    resShips.textContent = destroyedCount;
    resScore.textContent = score;

    resultsModal.classList.add('active');
    if (window.soundEngine) window.soundEngine.playVictory();
  }

  // Update Physics & Entities
  function update() {
    if (!gameActive) return;

    // Spawn timer
    spawnTimer++;
    if (spawnTimer >= Math.max(50, spawnInterval - wave * 10)) {
      spawnTimer = 0;
      spawnEnemyShip();
    }

    // Update enemy ships
    for (let i = ships.length - 1; i >= 0; i--) {
      const ship = ships[i];
      ship.y += ship.vy;

      // Enemy hit shield / bottom boundary
      if (ship.y >= HEIGHT - 60) {
        shield -= 25;
        createParticleExplosion(ship.x, ship.y, '#ff0055');
        if (window.soundEngine) window.soundEngine.playHeavyExplosion();

        if (targetShip && targetShip.id === ship.id) targetShip = null;
        ships.splice(i, 1);

        if (shield <= 0) {
          triggerGameOver();
          return;
        }
      }
    }

    // Update Plasma Bolts
    for (let i = plasmaBolts.length - 1; i >= 0; i--) {
      const b = plasmaBolts[i];
      b.progress += 0.2;
      if (b.progress >= 1.0) {
        plasmaBolts.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    updateTelemetryHUD();
  }

  // Render Loop with Screen Shake
  function render() {
    ctx.save();

    // Canvas Screen Shake Offset
    if (shakeTime > 0) {
      shakeTime--;
      const shakeIntensity = 7;
      const shakeX = (Math.random() - 0.5) * shakeIntensity;
      const shakeY = (Math.random() - 0.5) * shakeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    ctx.clearRect(-10, -10, WIDTH + 20, HEIGHT + 20);

    // Draw Grid Lines (Retro Space Theme)
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.strokeStyle = isLight ? 'rgba(0, 119, 255, 0.08)' : 'rgba(0, 243, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
    }
    for (let y = 0; y < HEIGHT; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
    }

    // Draw Player Cannon Base
    ctx.fillStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(PLAYER_POS.x, PLAYER_POS.y + 10, 20, Math.PI, 0);
    ctx.fill();

    // Draw Plasma Bolts
    plasmaBolts.forEach(b => {
      const curX = b.x + (b.targetX - b.x) * b.progress;
      const curY = b.y + (b.targetY - b.y) * b.progress;

      ctx.strokeStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 15;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(curX, curY);
      ctx.stroke();
    });

    // Draw Enemy Ships & Word Labels
    ships.forEach(ship => {
      const isTarget = targetShip && targetShip.id === ship.id;

      // Ship Triangular Sprite
      ctx.shadowColor = ship.color;
      ctx.shadowBlur = isTarget ? 25 : 12;
      ctx.fillStyle = ship.color;

      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y + 15);
      ctx.lineTo(ship.x - 14, ship.y - 10);
      ctx.lineTo(ship.x + 14, ship.y - 10);
      ctx.closePath();
      ctx.fill();

      // Word Label Overlay above ship
      ctx.font = 'bold 1.1rem monospace';
      ctx.textAlign = 'center';

      const typedPart = ship.word.substring(0, ship.typedLength);
      const remainingPart = ship.word.substring(ship.typedLength);

      const totalWidth = ctx.measureText(ship.word).width;
      let startX = ship.x - totalWidth / 2;

      // Draw Typed Part (Glowing Neon Green)
      if (typedPart) {
        ctx.fillStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 15;
        ctx.textAlign = 'left';
        ctx.fillText(typedPart, startX, ship.y - 18);
        startX += ctx.measureText(typedPart).width;
      }

      // Draw Remaining Part (White or Target Cyan)
      if (remainingPart) {
        ctx.fillStyle = isTarget ? '#00f3ff' : (isLight ? '#1a202c' : '#ffffff');
        ctx.shadowBlur = isTarget ? 15 : 0;
        ctx.textAlign = 'left';
        ctx.fillText(remainingPart, startX, ship.y - 18);
      }
    });

    // Draw Particles
    particles.forEach(p => {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
