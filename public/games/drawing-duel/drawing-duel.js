// Drawing & Guessing Duel Logic

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  const myRole = urlParams.get('role') || 'P1';
  const myName = decodeURIComponent(urlParams.get('name') || 'Player');

  const socket = window.parent.getArcadeSocket ? window.parent.getArcadeSocket() : null;

  // DOM Elements
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  const wordDisplayBox = document.getElementById('word-display-box');
  const scoreP1 = document.getElementById('score-p1');
  const scoreP2 = document.getElementById('score-p2');

  const wordPickerOverlay = document.getElementById('word-picker-overlay');
  const wordOptionsContainer = document.getElementById('word-options-container');

  const drawerToolbar = document.getElementById('drawer-toolbar');
  const clearCanvasBtn = document.getElementById('clear-canvas-btn');

  const chatMessages = document.getElementById('chat-messages');
  const guessInput = document.getElementById('guess-input');
  const sendGuessBtn = document.getElementById('send-guess-btn');

  // Drawing State
  let isDrawer = (myRole === 'P1');
  let isDrawing = false;
  let currentColor = '#000000';
  let currentSize = 4;
  let prevPos = { x: 0, y: 0 };

  // Set line styling defaults
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Initialize Role State
  setupRoleUI();

  function setupRoleUI() {
    if (isDrawer) {
      drawerToolbar.style.opacity = '1';
      drawerToolbar.style.pointerEvents = 'auto';
      guessInput.disabled = true;
      guessInput.placeholder = "You are drawing! Watch chat for guesses.";
      wordPickerOverlay.classList.remove('hidden');
      // Set random words if socket absent or initial
      setWordOptions(['DRAGON', 'ROBOT', 'PIZZA']);
    } else {
      drawerToolbar.style.opacity = '0.4';
      drawerToolbar.style.pointerEvents = 'none';
      guessInput.disabled = false;
      guessInput.placeholder = "Type your guess here...";
      wordPickerOverlay.classList.add('hidden');
      wordDisplayBox.textContent = "WAITING FOR DRAWER...";
    }
  }

  function setWordOptions(words) {
    wordOptionsContainer.innerHTML = '';
    words.forEach(w => {
      const card = document.createElement('div');
      card.className = 'word-card';
      card.textContent = w;
      card.addEventListener('click', () => {
        selectWord(w);
      });
      wordOptionsContainer.appendChild(card);
    });
  }

  function selectWord(word) {
    wordPickerOverlay.classList.add('hidden');
    wordDisplayBox.textContent = `WORD: ${word}`;
    clearCanvas();
    if (socket) {
      socket.emit('draw-select-word', { word });
    }
  }

  // Color Swatch Listeners
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      e.target.classList.add('active');
      currentColor = e.target.getAttribute('data-color');
    });
  });

  clearCanvasBtn.addEventListener('click', () => {
    if (!isDrawer) return;
    clearCanvas();
    if (socket) socket.emit('draw-clear-canvas');
  });

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Mouse & Touch Drawing Handlers
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function startDrawing(e) {
    if (!isDrawer) return;
    isDrawing = true;
    prevPos = getCanvasCoords(e);
  }

  function drawMove(e) {
    if (!isDrawer || !isDrawing) return;
    const currPos = getCanvasCoords(e);

    // Render locally
    drawLine(prevPos.x, prevPos.y, currPos.x, currPos.y, currentColor, currentSize);

    // Stream line packet via socket
    if (socket) {
      socket.emit('draw-stroke-data', {
        x1: prevPos.x / canvas.width,
        y1: prevPos.y / canvas.height,
        x2: currPos.x / canvas.width,
        y2: currPos.y / canvas.height,
        color: currentColor,
        size: currentSize
      });
    }

    prevPos = currPos;
  }

  function stopDrawing() {
    isDrawing = false;
  }

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', drawMove);
  window.addEventListener('mouseup', stopDrawing);

  canvas.addEventListener('touchstart', (e) => { startDrawing(e); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { drawMove(e); e.preventDefault(); }, { passive: false });
  window.addEventListener('touchend', stopDrawing);

  function drawLine(x1, y1, x2, y2, color, size) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Chat & Guessing
  sendGuessBtn.addEventListener('click', submitGuess);
  guessInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') submitGuess();
  });

  function submitGuess() {
    const guess = guessInput.value.trim();
    if (!guess || isDrawer) return;

    guessInput.value = '';
    if (socket) {
      socket.emit('draw-submit-guess', {
        guess,
        playerName: myName
      });
    } else {
      // Local fallback test
      appendChatMessage(myName, guess, false);
    }
  }

  function appendChatMessage(name, text, isCorrect) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${isCorrect ? 'correct' : ''}`;
    msg.innerHTML = `<strong>${name}:</strong> ${text}`;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Socket Event Handlers
  if (socket) {
    socket.on('draw-stroke-data', (data) => {
      if (!isDrawer) {
        drawLine(
          data.x1 * canvas.width,
          data.y1 * canvas.height,
          data.x2 * canvas.width,
          data.y2 * canvas.height,
          data.color,
          data.size
        );
      }
    });

    socket.on('draw-clear-canvas', () => {
      if (!isDrawer) clearCanvas();
    });

    socket.on('draw-word-chosen', (data) => {
      if (!isDrawer) {
        wordDisplayBox.textContent = `HINT: ${data.wordHint}`;
        clearCanvas();
        appendChatMessage('System', 'Drawer has selected a word! Start guessing!', false);
      }
    });

    socket.on('draw-chat-message', (data) => {
      appendChatMessage(data.playerName, data.message, false);
      if (window.soundEngine) window.soundEngine.playClick();
    });

    socket.on('draw-guess-correct', (data) => {
      appendChatMessage('🎉 SYSTEM', `${data.guesserName} GUESSED IT! The word was "${data.word}"!`, true);
      if (window.soundEngine) window.soundEngine.playVictory();

      scoreP1.textContent = data.scores.P1 || 0;
      scoreP2.textContent = data.scores.P2 || 0;

      // Update role for next round
      isDrawer = (data.nextDrawerRole === myRole);
      setTimeout(() => {
        setupRoleUI();
        if (isDrawer && data.wordOptions) {
          setWordOptions(data.wordOptions);
        }
      }, 2500);
    });
  }
})();
