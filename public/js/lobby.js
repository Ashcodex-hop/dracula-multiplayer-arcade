// Frontend Lobby & Room Socket Management Script (Dracula Arcade)

(function () {
  // Configurable Socket Backend URL
  const RENDER_BACKEND_URL = 'https://dracula-arcade-backend.onrender.com';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isFirebaseHosting = window.location.hostname.endsWith('.web.app') || window.location.hostname.endsWith('.firebaseapp.com');

  const defaultBackend = isLocal
    ? 'http://localhost:3000'
    : (isFirebaseHosting ? RENDER_BACKEND_URL : window.location.origin);

  let backendUrl = localStorage.getItem('socket_server_url') || defaultBackend;

  let socket = null;
  function connectSocket(targetUrl) {
    if (socket) {
      try { socket.disconnect(); } catch (e) {}
    }

    if (typeof window !== 'undefined' && typeof window.io === 'function') {
      try {
        socket = window.io(targetUrl || backendUrl, {
          reconnectionAttempts: 5,
          timeout: 5000,
          transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
          console.log('✅ Connected to Dracula Multiplayer Backend:', socket.id);
          fetchRooms();
        });
      } catch (e) {
        console.warn('Socket.io init notice:', e);
      }
    }
  }

  // State
  let playerState = {
    name: localStorage.getItem('neon_player_name') || 'Vampire_' + Math.floor(Math.random() * 900 + 100),
    avatar: localStorage.getItem('neon_player_avatar') || '🩸',
    theme: localStorage.getItem('neon_theme') || 'dark',
    roomCode: null,
    role: null,
    gameId: null
  };

  const AVATARS = ['🩸', '⚡', '🔥', '🤖', '👾', '🚀', '🔮', '🎯', '🦇'];

  // DOM Elements
  const playerDisplayName = document.getElementById('player-display-name');
  const avatarToggleBtn = document.getElementById('avatar-toggle-btn');
  const editNameBtn = document.getElementById('edit-name-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeBtnIcon = document.getElementById('theme-btn-icon');
  const themeBtnText = document.getElementById('theme-btn-text');

  const roomCodeInput = document.getElementById('room-code-input');
  const joinRoomBtn = document.getElementById('join-room-btn');
  const roomsContainer = document.getElementById('rooms-container');
  const refreshRoomsBtn = document.getElementById('refresh-rooms-btn');
  const muteSfxBtn = document.getElementById('mute-sfx-btn');

  // Modal DOM
  const roomModal = document.getElementById('room-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalGameName = document.getElementById('modal-game-name');
  const modalRoomCode = document.getElementById('modal-room-code');
  const copyCodeBtn = document.getElementById('copy-code-btn');

  const slotP1 = document.getElementById('slot-p1');
  const slotP1Avatar = document.getElementById('slot-p1-avatar');
  const slotP1Name = document.getElementById('slot-p1-name');
  const slotP1Status = document.getElementById('slot-p1-status');

  const slotP2 = document.getElementById('slot-p2');
  const slotP2Avatar = document.getElementById('slot-p2-avatar');
  const slotP2Name = document.getElementById('slot-p2-name');
  const slotP2Status = document.getElementById('slot-p2-status');

  const readyBtn = document.getElementById('ready-btn');
  const leaveRoomBtn = document.getElementById('leave-room-btn');

  // Arena Overlay DOM
  const gameArenaOverlay = document.getElementById('game-arena-overlay');
  const arenaGameTitle = document.getElementById('arena-game-title');
  const arenaRoomTag = document.getElementById('arena-room-tag');
  const arenaExitBtn = document.getElementById('arena-exit-btn');
  const gameIframe = document.getElementById('game-iframe');

  // Theme Switcher Engine
  function applyTheme(theme) {
    playerState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('neon_theme', theme);

    if (themeBtnIcon && themeBtnText) {
      if (theme === 'light') {
        themeBtnIcon.textContent = '☀️';
        themeBtnText.textContent = 'LIGHT MODE';
      } else {
        themeBtnIcon.textContent = '🌙';
        themeBtnText.textContent = 'DARK MODE';
      }
    }

    if (gameIframe && gameIframe.contentWindow) {
      try {
        gameIframe.contentWindow.document.documentElement.setAttribute('data-theme', theme);
      } catch (e) { /* ignore cross-origin */ }
    }
  }


  // Initialize UI Event Listeners
  function initUI() {
    if (playerDisplayName) playerDisplayName.textContent = playerState.name;
    if (avatarToggleBtn) avatarToggleBtn.textContent = playerState.avatar;
    applyTheme(playerState.theme);

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const nextTheme = playerState.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        if (window.soundEngine) window.soundEngine.playClick();
      });
    }

    // Attach Create Room listeners to buttons and cards cleanly with bubbling guard
    document.querySelectorAll('.btn-create-game').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameId = btn.getAttribute('data-game-id');
        if (gameId) createRoom(gameId);
      });
    });

    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-create-game')) return;
        const gameId = card.getAttribute('data-game-id');
        if (gameId) createRoom(gameId);
      });
    });

    // Join room listener
    if (joinRoomBtn && roomCodeInput) {
      joinRoomBtn.addEventListener('click', () => {
        const code = roomCodeInput.value.toUpperCase().trim();
        if (code.length === 4) {
          joinRoom(code);
        } else {
          alert('Please enter a valid 4-character room code.');
        }
      });

      roomCodeInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') joinRoomBtn.click();
      });
    }

    // Edit Name
    if (editNameBtn) {
      editNameBtn.addEventListener('click', () => {
        const newName = prompt('Enter your player nickname:', playerState.name);
        if (newName && newName.trim().length > 0) {
          playerState.name = newName.trim().substring(0, 16);
          localStorage.setItem('neon_player_name', playerState.name);
          if (playerDisplayName) playerDisplayName.textContent = playerState.name;
        }
      });
    }

    // Toggle Avatar
    if (avatarToggleBtn) {
      avatarToggleBtn.addEventListener('click', () => {
        const currentIdx = AVATARS.indexOf(playerState.avatar);
        const nextIdx = (currentIdx + 1) % AVATARS.length;
        playerState.avatar = AVATARS[nextIdx];
        localStorage.setItem('neon_player_avatar', playerState.avatar);
        avatarToggleBtn.textContent = playerState.avatar;
        if (window.soundEngine) window.soundEngine.playClick();
      });
    }

    // Mute SFX
    if (muteSfxBtn) {
      muteSfxBtn.addEventListener('click', () => {
        if (window.soundEngine) {
          window.soundEngine.muted = !window.soundEngine.muted;
          muteSfxBtn.textContent = window.soundEngine.muted ? '🔇 Muted' : '🔊 SFX';
        }
      });
    }

    // Modal controls
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => leaveRoom());
    if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', () => leaveRoom());

    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', () => {
        if (playerState.roomCode) {
          navigator.clipboard.writeText(playerState.roomCode);
          if (window.soundEngine) window.soundEngine.playClick();
          copyCodeBtn.textContent = '✅';
          setTimeout(() => copyCodeBtn.textContent = '📋', 1500);
        }
      });
    }

    if (readyBtn) {
      readyBtn.addEventListener('click', () => {
        if (window.soundEngine) window.soundEngine.playClick();
        if (socket && socket.connected) {
          socket.emit('player-ready', { ready: true });
          readyBtn.disabled = true;
          readyBtn.textContent = 'READY! WAITING FOR START...';
        } else {
          // Direct / Standalone launch
          closeModal();
          launchGameArena({
            gameId: playerState.gameId,
            code: playerState.roomCode
          });
        }
      });
    }

    // Refresh rooms
    if (refreshRoomsBtn) {
      refreshRoomsBtn.addEventListener('click', () => {
        fetchRooms();
        if (window.soundEngine) window.soundEngine.playClick();
      });
    }

    // Arena Exit
    if (arenaExitBtn) {
      arenaExitBtn.addEventListener('click', () => {
        if (confirm('Leave current game match?')) {
          leaveRoom();
          closeArena();
        }
      });
    }

    bindSocketEvents();
    fetchRooms();
  }

  // Socket Logic
  function fetchRooms() {
    if (socket && socket.connected) {
      socket.emit('get-rooms', (rooms) => renderRoomsList(rooms));
    } else {
      renderRoomsList([]);
    }
  }

  function bindSocketEvents() {
    if (!socket) return;

    socket.on('rooms-updated', () => fetchRooms());

    socket.on('join-error', (err) => {
      alert(err.message || 'Could not join room.');
    });

    socket.on('room-updated', (room) => {
      updateModalState(room);
    });

    socket.on('player-left', (data) => {
      alert(data.message);
      if (data.room) updateModalState(data.room);
      else closeModal();
    });

    socket.on('game-start', (room) => {
      if (window.soundEngine) window.soundEngine.playVictory();
      closeModal();
      launchGameArena(room);
    });

    socket.on('game-restarted', (room) => {
      closeArena();
      openModal(room);
    });
  }

  function renderRoomsList(rooms) {
    if (!roomsContainer) return;
    roomsContainer.innerHTML = '';
    if (!rooms || rooms.length === 0) {
      roomsContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1/-1;">No active multiplayer rooms open. Create one above!</p>`;
      return;
    }

    rooms.forEach(r => {
      const chip = document.createElement('div');
      chip.className = 'room-chip';
      chip.innerHTML = `
        <div>
          <span class="room-chip-code">${r.code}</span>
          <div class="room-chip-game">${formatGameName(r.gameId)}</div>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-muted);">${r.playerCount}/2 Players</span>
      `;
      chip.addEventListener('click', () => {
        if (r.playerCount < 2) {
          joinRoom(r.code);
        } else {
          alert('Room is currently full.');
        }
      });
      roomsContainer.appendChild(chip);
    });
  }

  function createRoom(gameId) {
    if (window.soundEngine) window.soundEngine.playClick();

    // Word Shot direct launch support
    if (gameId === 'word-shot' || gameId === 'type-shooter') {
      launchDirectGame('word-shot');
      return;
    }

    if (socket && socket.connected) {
      socket.emit('create-room', {
        gameId,
        playerName: playerState.name,
        avatar: playerState.avatar
      }, (res) => {
        if (res && res.success) {
          playerState.roomCode = res.roomCode;
          playerState.role = 'P1';
          playerState.gameId = gameId;
          openModal(res.room);
          if (window.soundEngine) window.soundEngine.playJoin();
        }
      });
    } else {
      alert('Connecting to live multiplayer server... Please check network status.');
    }
  }

  function joinRoom(code) {
    if (window.soundEngine) window.soundEngine.playClick();

    if (socket && socket.connected) {
      socket.emit('join-room', {
        roomCode: code,
        playerName: playerState.name,
        avatar: playerState.avatar
      }, (res) => {
        if (res && res.success) {
          playerState.roomCode = res.roomCode;
          playerState.role = 'P2';
          playerState.gameId = res.room.gameId;
          openModal(res.room);
          if (window.soundEngine) window.soundEngine.playJoin();
        } else {
          alert(res ? res.message : 'Error joining room.');
        }
      });
    } else {
      alert('Connecting to live multiplayer server... Please check network status.');
    }
  }

  function leaveRoom() {
    if (socket && socket.connected) {
      socket.emit('leave-room');
    }
    playerState.roomCode = null;
    playerState.role = null;
    playerState.gameId = null;
    closeModal();
    closeArena();
  }

  // Modal UI Handlers
  function openModal(room) {
    if (!roomModal) return;
    if (modalGameName) modalGameName.textContent = formatGameName(room.gameId);
    if (modalRoomCode) modalRoomCode.textContent = room.code;
    roomModal.classList.add('active');
    updateModalState(room);
  }

  function closeModal() {
    if (roomModal) roomModal.classList.remove('active');
  }

  function updateModalState(room) {
    const p1 = room.players.find(p => p.role === 'P1');
    const p2 = room.players.find(p => p.role === 'P2');

    if (p1) {
      if (slotP1Avatar) slotP1Avatar.textContent = p1.avatar || '🩸';
      if (slotP1Name) slotP1Name.textContent = p1.name;
      if (slotP1Status) slotP1Status.textContent = p1.ready ? 'READY!' : 'P1 (HOST)';
      if (slotP1) slotP1.classList.add('filled');
    }

    if (p2) {
      if (slotP2Avatar) slotP2Avatar.textContent = p2.avatar || '⚡';
      if (slotP2Name) slotP2Name.textContent = p2.name;
      if (slotP2Status) slotP2Status.textContent = p2.ready ? 'READY!' : 'P2 (GUEST)';
      if (slotP2) slotP2.classList.add('filled');
    } else {
      if (slotP2Avatar) slotP2Avatar.textContent = '❓';
      if (slotP2Name) slotP2Name.textContent = 'Waiting for player...';
      if (slotP2Status) slotP2Status.textContent = 'WAITING';
      if (slotP2) slotP2.classList.remove('filled');
    }

    // Enable Start / Ready button
    if (readyBtn) {
      if (p1 && p2) {
        readyBtn.disabled = false;
        readyBtn.textContent = playerState.role === 'P1' ? 'START MULTIPLAYER MATCH' : 'TOGGLE READY';
      } else {
        readyBtn.disabled = false;
        readyBtn.textContent = 'LAUNCH ARENA MATCH';
      }
    }
  }

  // Launch Game Arena inside Iframe Overlay
  function launchGameArena(room) {
    const gamePath = getGamePath(room.gameId);
    const gameUrl = `${gamePath}?room=${room.code}&role=${playerState.role || 'P1'}&name=${encodeURIComponent(playerState.name)}&theme=${playerState.theme}`;

    if (arenaGameTitle) arenaGameTitle.textContent = formatGameName(room.gameId);
    if (arenaRoomTag) arenaRoomTag.textContent = `ROOM: ${room.code}`;
    if (gameIframe) gameIframe.src = gameUrl;
    if (gameArenaOverlay) gameArenaOverlay.classList.add('active');
  }

  function launchDirectGame(gameId) {
    const gamePath = getGamePath(gameId);
    const gameUrl = `${gamePath}?theme=${playerState.theme}`;

    if (arenaGameTitle) arenaGameTitle.textContent = formatGameName(gameId);
    if (arenaRoomTag) arenaRoomTag.textContent = 'SOLO MODE';
    if (gameIframe) gameIframe.src = gameUrl;
    if (gameArenaOverlay) gameArenaOverlay.classList.add('active');
  }

  function closeArena() {
    if (gameArenaOverlay) gameArenaOverlay.classList.remove('active');
    if (gameIframe) gameIframe.src = '';
  }

  function getGamePath(gameId) {
    switch (gameId) {
      case 'chaos-pong': return '/games/chaos-pong/index.html';
      case 'drawing-duel': return '/games/drawing-duel/index.html';
      case 'tank-tactics': return '/games/tank-tactics/index.html';
      case 'tug-of-war': return '/games/tug-of-war/index.html';
      case 'laser-maze': return '/games/laser-maze/index.html';
      case 'word-shot':
      case 'type-shooter': return '/games/word-shot/index.html';
      default: return '/games/chaos-pong/index.html';
    }
  }

  function formatGameName(gameId) {
    switch (gameId) {
      case 'chaos-pong': return 'Chaos Pong';
      case 'drawing-duel': return 'Drawing & Guessing Duel';
      case 'tank-tactics': return 'Tank Tactics';
      case 'tug-of-war': return '1v1 Tug-of-War';
      case 'laser-maze': return 'Co-op Laser Maze Defusal';
      case 'word-shot':
      case 'type-shooter': return 'Word Shot';
      default: return 'Arcade Game';
    }
  }

  // Initialize on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  // Expose helper to iframe children
  window.getArcadeSocket = function () {
    return socket;
  };
})();
