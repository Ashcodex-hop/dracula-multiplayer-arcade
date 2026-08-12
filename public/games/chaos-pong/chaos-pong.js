// Chaos Pong Networked Engine (Dracula Theme)

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  const myRole = urlParams.get('role') || 'P1';
  const myName = decodeURIComponent(urlParams.get('name') || 'Player');

  const socket = window.parent.getArcadeSocket ? window.parent.getArcadeSocket() : null;

  // DOM Elements
  const canvas = document.getElementById('pong-canvas');
  const ctx = canvas.getContext('2d');
  const scoreP1 = document.getElementById('score-p1');
  const scoreP2 = document.getElementById('score-p2');
  const nameP1 = document.getElementById('name-p1');
  const nameP2 = document.getElementById('name-p2');
  const chaosFillP1 = document.getElementById('chaos-fill-p1');
  const chaosFillP2 = document.getElementById('chaos-fill-p2');

  const btnGravity = document.getElementById('btn-gravity');
  const btnWind = document.getElementById('btn-wind');
  const btnShrink = document.getElementById('btn-shrink');

  if (myRole === 'P1') {
    nameP1.textContent = `${myName} (P1)`;
  } else {
    nameP2.textContent = `${myName} (P2)`;
  }

  // Game Dimensions & Constants
  const WIDTH = 850;
  const HEIGHT = 480;
  const PADDLE_WIDTH = 14;
  let PADDLE_HEIGHT_P1 = 90;
  let PADDLE_HEIGHT_P2 = 90;

  // Game State
  const state = {
    p1Y: HEIGHT / 2 - 45,
    p2Y: HEIGHT / 2 - 45,
    ball: {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      vx: 6 * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() - 0.5) * 6,
      radius: 9
    },
    scores: { P1: 0, P2: 0 },
    chaos: { P1: 0, P2: 0 },
    activeEffects: {
      gravity: 0,
      wind: 0,
      p1Shrunk: false,
      p2Shrunk: false
    },
    particles: []
  };

  // Paddle Movement Input
  function handleInput(clientY) {
    const rect = canvas.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const paddleH = myRole === 'P1' ? PADDLE_HEIGHT_P1 : PADDLE_HEIGHT_P2;
    let newY = relativeY - paddleH / 2;
    newY = Math.max(10, Math.min(HEIGHT - paddleH - 10, newY));

    if (myRole === 'P1') {
      state.p1Y = newY;
    } else {
      state.p2Y = newY;
    }

    if (socket) {
      socket.emit('pong-paddle-move', {
        role: myRole,
        yRatio: newY / (HEIGHT - paddleH)
      });
    }
  }

  canvas.addEventListener('mousemove', (e) => handleInput(e.clientY));
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches[0]) handleInput(e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const step = 24;
    const paddleH = myRole === 'P1' ? PADDLE_HEIGHT_P1 : PADDLE_HEIGHT_P2;
    let currY = myRole === 'P1' ? state.p1Y : state.p2Y;

    if (e.key === 'ArrowUp' || e.key === 'w') currY -= step;
    if (e.key === 'ArrowDown' || e.key === 's') currY += step;

    currY = Math.max(10, Math.min(HEIGHT - paddleH - 10, currY));
    if (myRole === 'P1') state.p1Y = currY;
    else state.p2Y = currY;

    if (socket) {
      socket.emit('pong-paddle-move', {
        role: myRole,
        yRatio: currY / (HEIGHT - paddleH)
      });
    }
  });

  // Socket Listeners
  if (socket) {
    socket.on('pong-opponent-paddle', (data) => {
      if (data.role !== myRole) {
        const paddleH = data.role === 'P1' ? PADDLE_HEIGHT_P1 : PADDLE_HEIGHT_P2;
        const targetY = data.yRatio * (HEIGHT - paddleH);
        if (data.role === 'P1') state.p1Y = targetY;
        else state.p2Y = targetY;
      }
    });

    socket.on('pong-ball-sync', (data) => {
      if (myRole === 'P2') {
        state.ball.x = data.xRatio * WIDTH;
        state.ball.y = data.yRatio * HEIGHT;
        state.ball.vx = data.vx;
        state.ball.vy = data.vy;
      }
    });

    socket.on('pong-score-updated', (scores) => {
      state.scores = scores;
      scoreP1.textContent = scores.P1;
      scoreP2.textContent = scores.P2;
      if (window.soundEngine) window.soundEngine.playScore();
    });

    socket.on('pong-chaos-triggered', (data) => {
      triggerChaosEffect(data.type, data.byRole);
    });
  }

  // Chaos Abilities Buttons
  btnGravity.addEventListener('click', () => useAbility('gravity'));
  btnWind.addEventListener('click', () => useAbility('wind'));
  btnShrink.addEventListener('click', () => useAbility('shrink'));

  function useAbility(type) {
    const myMeter = state.chaos[myRole];
    if (myMeter >= 100) {
      state.chaos[myRole] = 0;
      updateChaosMeters();
      if (socket) {
        socket.emit('pong-chaos-trigger', { type, byRole: myRole });
      } else {
        triggerChaosEffect(type, myRole);
      }
    }
  }

  function triggerChaosEffect(type, byRole) {
    createExplosion(WIDTH / 2, HEIGHT / 2, type === 'shrink' ? '#ff1a1a' : '#e50914');
    if (window.soundEngine) window.soundEngine.playLaser();

    if (type === 'gravity') {
      state.activeEffects.gravity = (Math.random() > 0.5 ? 0.35 : -0.35);
      setTimeout(() => state.activeEffects.gravity = 0, 6000);
    } else if (type === 'wind') {
      state.activeEffects.wind = (byRole === 'P1' ? 0.25 : -0.25);
      setTimeout(() => state.activeEffects.wind = 0, 5000);
    } else if (type === 'shrink') {
      const targetRole = byRole === 'P1' ? 'P2' : 'P1';
      if (targetRole === 'P1') PADDLE_HEIGHT_P1 = 50;
      else PADDLE_HEIGHT_P2 = 50;

      setTimeout(() => {
        PADDLE_HEIGHT_P1 = 90;
        PADDLE_HEIGHT_P2 = 90;
      }, 6000);
    }
  }

  function updateChaosMeters() {
    chaosFillP1.style.width = `${Math.min(100, state.chaos.P1)}%`;
    chaosFillP2.style.width = `${Math.min(100, state.chaos.P2)}%`;

    const myMeter = state.chaos[myRole];
    btnGravity.disabled = myMeter < 100;
    btnWind.disabled = myMeter < 100;
    btnShrink.disabled = myMeter < 100;
  }

  function addChaosProgress(amount = 15) {
    state.chaos.P1 = Math.min(100, state.chaos.P1 + amount);
    state.chaos.P2 = Math.min(100, state.chaos.P2 + amount);
    updateChaosMeters();
  }

  function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color
      });
    }
  }

  // Physics Loop
  function updatePhysics() {
    if (myRole === 'P1') {
      const ball = state.ball;

      ball.vy += state.activeEffects.gravity;
      ball.vx += state.activeEffects.wind;

      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.vy = -ball.vy;
        if (window.soundEngine) window.soundEngine.playPongHit();
      } else if (ball.y + ball.radius >= HEIGHT) {
        ball.y = HEIGHT - ball.radius;
        ball.vy = -ball.vy;
        if (window.soundEngine) window.soundEngine.playPongHit();
      }

      // Bounce P1 Paddle (Left - Blood Red)
      const p1X = 25;
      if (ball.vx < 0 && ball.x - ball.radius <= p1X + PADDLE_WIDTH && ball.x + ball.radius >= p1X) {
        if (ball.y >= state.p1Y && ball.y <= state.p1Y + PADDLE_HEIGHT_P1) {
          ball.x = p1X + PADDLE_WIDTH + ball.radius;
          ball.vx = Math.abs(ball.vx) * 1.05;
          const hitOffset = (ball.y - (state.p1Y + PADDLE_HEIGHT_P1 / 2)) / (PADDLE_HEIGHT_P1 / 2);
          ball.vy = hitOffset * 7;
          addChaosProgress(15);
          createExplosion(ball.x, ball.y, '#e50914');
          if (window.soundEngine) window.soundEngine.playPongHit();
        }
      }

      // Bounce P2 Paddle (Right - Silver White)
      const p2X = WIDTH - 25 - PADDLE_WIDTH;
      if (ball.vx > 0 && ball.x + ball.radius >= p2X && ball.x - ball.radius <= p2X + PADDLE_WIDTH) {
        if (ball.y >= state.p2Y && ball.y <= state.p2Y + PADDLE_HEIGHT_P2) {
          ball.x = p2X - ball.radius;
          ball.vx = -Math.abs(ball.vx) * 1.05;
          const hitOffset = (ball.y - (state.p2Y + PADDLE_HEIGHT_P2 / 2)) / (PADDLE_HEIGHT_P2 / 2);
          ball.vy = hitOffset * 7;
          addChaosProgress(15);
          createExplosion(ball.x, ball.y, '#ffffff');
          if (window.soundEngine) window.soundEngine.playPongHit();
        }
      }

      if (ball.x < 0) {
        state.scores.P2 += 1;
        resetBall(1);
        if (socket) socket.emit('pong-score-update', { scores: state.scores });
      } else if (ball.x > WIDTH) {
        state.scores.P1 += 1;
        resetBall(-1);
        if (socket) socket.emit('pong-score-update', { scores: state.scores });
      }

      if (socket && Math.random() > 0.3) {
        socket.emit('pong-ball-sync', {
          xRatio: ball.x / WIDTH,
          yRatio: ball.y / HEIGHT,
          vx: ball.vx,
          vy: ball.vy
        });
      }
    }
  }

  function resetBall(direction) {
    state.ball.x = WIDTH / 2;
    state.ball.y = HEIGHT / 2;
    state.ball.vx = 6 * direction;
    state.ball.vy = (Math.random() - 0.5) * 5;
  }

  // Render Loop
  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Center Dashed Net
    ctx.strokeStyle = 'rgba(229, 9, 20, 0.2)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw P1 Paddle (Left - Dracula Crimson)
    const p1X = 25;
    ctx.shadowColor = '#e50914';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#e50914';
    ctx.fillRect(p1X, state.p1Y, PADDLE_WIDTH, PADDLE_HEIGHT_P1);

    // Draw P2 Paddle (Right - Silver White)
    const p2X = WIDTH - 25 - PADDLE_WIDTH;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p2X, state.p2Y, PADDLE_WIDTH, PADDLE_HEIGHT_P2);

    // Draw Ball
    ctx.shadowColor = '#ff1a1a';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff1a1a';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Render Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }

  function loop() {
    updatePhysics();
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
