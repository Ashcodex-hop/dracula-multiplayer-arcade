const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Copy AI generated game preview assets
const fs = require('fs');
const assetSrc = 'C:\\Users\\ashmi\\.gemini\\antigravity-ide\\brain\\eb12a3b5-7bb2-4475-bb7f-14b5d435dfac';
const assetDest = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(assetDest)) fs.mkdirSync(assetDest, { recursive: true });

const assetMap = {
  'hero_banner_bg_1786488978678.png': 'hero_banner_bg.png',
  'chaos_pong_preview_1786488662337.png': 'chaos_pong_preview.png',
  'drawing_duel_preview_1786489411130.png': 'drawing_duel_preview.png',
  'tank_tactics_preview_1786489426500.png': 'tank_tactics_preview.png',
  'tug_of_war_preview_1786489443771.png': 'tug_of_war_preview.png',
  'laser_maze_preview_1786489459458.png': 'laser_maze_preview.png',
  'word_shot_preview_1786489473438.png': 'word_shot_preview.png'
};

for (const [src, dest] of Object.entries(assetMap)) {
  const sPath = path.join(assetSrc, src);
  const dPath = path.join(assetDest, dest);
  if (fs.existsSync(sPath)) {
    try { fs.copyFileSync(sPath, dPath); } catch (e) {}
  }
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route for SPA / game views
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Room State Storage
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Drawing Duel secret word list generator
const WORD_LIST = [
  'PIZZA', 'ROCKET', 'DRAGON', 'GUITAR', 'PENGUIN', 
  'VOLCANO', 'ROBOT', 'CASTLE', 'SKATEBOARD', 'PIRATE',
  'SUBMARINE', 'TELESCOPE', 'UNICORN', 'LIGHTSABER', 'HELICOPTER',
  'DIAMOND', 'BATTERY', 'FIREWORKS', 'SPIDER', 'SPACESHIP'
];

function getRandomWords(count = 3) {
  const shuffled = [...WORD_LIST].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Fetch list of active public rooms
  socket.on('get-rooms', (ack) => {
    const activeRooms = [];
    rooms.forEach((room) => {
      activeRooms.push({
        code: room.code,
        gameId: room.gameId,
        playerCount: room.players.length,
        maxPlayers: 2,
        status: room.status,
        hostName: room.players[0] ? room.players[0].name : 'Unknown'
      });
    });
    if (typeof ack === 'function') ack(activeRooms);
    else socket.emit('rooms-list', activeRooms);
  });

  // Create a new multiplayer room
  socket.on('create-room', (data, ack) => {
    const { gameId, playerName, avatar } = data;
    const roomCode = generateRoomCode();

    const newRoom = {
      code: roomCode,
      gameId: gameId || 'chaos-pong',
      status: 'waiting', // waiting, playing, finished
      createdAt: Date.now(),
      players: [
        {
          id: socket.id,
          name: playerName || 'Player 1',
          role: 'P1',
          avatar: avatar || '⚡',
          ready: false,
          score: 0
        }
      ],
      gameState: {
        round: 1,
        scores: { P1: 0, P2: 0 }
      }
    };

    rooms.set(roomCode, newRoom);
    socket.join(roomCode);
    socket.currentRoom = roomCode;

    console.log(`[Room Created] Code: ${roomCode}, Game: ${gameId}, Host: ${playerName}`);

    const response = {
      success: true,
      roomCode,
      role: 'P1',
      room: newRoom
    };

    if (typeof ack === 'function') ack(response);
    socket.emit('room-created', response);
    io.emit('rooms-updated');
  });

  // Join an existing room
  socket.on('join-room', (data, ack) => {
    const { roomCode, playerName, avatar } = data;
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(cleanCode);

    if (!room) {
      const err = { success: false, message: 'Room code not found. Check code and try again.' };
      if (typeof ack === 'function') ack(err);
      return socket.emit('join-error', err);
    }

    if (room.players.length >= 2) {
      const err = { success: false, message: 'Room is already full (2/2 players).' };
      if (typeof ack === 'function') ack(err);
      return socket.emit('join-error', err);
    }

    const player2 = {
      id: socket.id,
      name: playerName || 'Player 2',
      role: 'P2',
      avatar: avatar || '🔥',
      ready: false,
      score: 0
    };

    room.players.push(player2);
    socket.join(cleanCode);
    socket.currentRoom = cleanCode;

    console.log(`[Room Joined] Code: ${cleanCode}, Player: ${playerName}`);

    const response = {
      success: true,
      roomCode: cleanCode,
      role: 'P2',
      room
    };

    if (typeof ack === 'function') ack(response);
    socket.emit('room-joined', response);
    io.to(cleanCode).emit('room-updated', room);
    io.emit('rooms-updated');
  });

  // Toggle player ready status
  socket.on('player-ready', (data) => {
    const roomCode = socket.currentRoom;
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.ready = data ? data.ready : !player.ready;
    }

    // Check if both players are ready
    const allReady = room.players.length === 2 && room.players.every(p => p.ready);
    if (allReady) {
      room.status = 'playing';
      if (room.gameId === 'drawing-duel') {
        room.gameState.drawerRole = 'P1';
        room.gameState.currentWord = '';
        room.gameState.wordOptions = getRandomWords(3);
        room.gameState.round = 1;
      } else if (room.gameId === 'tug-of-war') {
        room.gameState.ropePos = 50;
      }
      io.to(roomCode).emit('game-start', room);
    } else {
      io.to(roomCode).emit('room-updated', room);
    }
  });

  // Return to lobby / restart game
  socket.on('restart-game', () => {
    const roomCode = socket.currentRoom;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.status = 'waiting';
    room.players.forEach(p => p.ready = false);
    room.gameState = { round: 1, scores: { P1: 0, P2: 0 } };
    io.to(roomCode).emit('game-restarted', room);
  });

  // Leave room handler
  socket.on('leave-room', () => {
    handleLeaveRoom(socket);
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    handleLeaveRoom(socket);
  });

  // ==================== GAME 1: CHAOS PONG EVENTS ====================
  socket.on('pong-paddle-move', (data) => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('pong-opponent-paddle', data);
  });

  socket.on('pong-ball-sync', (data) => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('pong-ball-sync', data);
  });

  socket.on('pong-score-update', (data) => {
    const room = rooms.get(socket.currentRoom);
    if (room) {
      room.gameState.scores = data.scores;
      io.to(socket.currentRoom).emit('pong-score-updated', room.gameState.scores);
    }
  });

  socket.on('pong-chaos-trigger', (data) => {
    if (!socket.currentRoom) return;
    io.to(socket.currentRoom).emit('pong-chaos-triggered', data);
  });

  // ==================== GAME 2: DRAWING DUEL EVENTS ====================
  socket.on('draw-stroke-data', (data) => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('draw-stroke-data', data);
  });

  socket.on('draw-clear-canvas', () => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('draw-clear-canvas');
  });

  socket.on('draw-select-word', (data) => {
    const room = rooms.get(socket.currentRoom);
    if (room) {
      room.gameState.currentWord = data.word.toUpperCase();
      io.to(socket.currentRoom).emit('draw-word-chosen', {
        drawerRole: room.gameState.drawerRole,
        wordLength: room.gameState.currentWord.length,
        wordHint: room.gameState.currentWord.replace(/[A-Z]/g, '_ ')
      });
    }
  });

  socket.on('draw-submit-guess', (data) => {
    const room = rooms.get(socket.currentRoom);
    if (!room) return;

    const guess = (data.guess || '').toUpperCase().trim();
    const correctWord = room.gameState.currentWord;
    const isCorrect = guess === correctWord;

    if (isCorrect) {
      const guesserRole = room.gameState.drawerRole === 'P1' ? 'P2' : 'P1';
      room.gameState.scores[guesserRole] = (room.gameState.scores[guesserRole] || 0) + 100;
      room.gameState.scores[room.gameState.drawerRole] = (room.gameState.scores[room.gameState.drawerRole] || 0) + 50;

      room.gameState.drawerRole = room.gameState.drawerRole === 'P1' ? 'P2' : 'P1';
      room.gameState.round += 1;
      room.gameState.wordOptions = getRandomWords(3);
      room.gameState.currentWord = '';

      io.to(socket.currentRoom).emit('draw-guess-correct', {
        guesserName: data.playerName,
        word: correctWord,
        scores: room.gameState.scores,
        round: room.gameState.round,
        nextDrawerRole: room.gameState.drawerRole,
        wordOptions: room.gameState.wordOptions
      });
    } else {
      io.to(socket.currentRoom).emit('draw-chat-message', {
        playerName: data.playerName,
        message: data.guess,
        isCorrect: false
      });
    }
  });

  // ==================== GAME 3: TANK TACTICS EVENTS ====================
  socket.on('tank-submit-fleet', (data) => {
    const room = rooms.get(socket.currentRoom);
    if (!room) return;

    if (!room.gameState.fleets) room.gameState.fleets = {};
    const playerRole = data.role;
    room.gameState.fleets[playerRole] = data.fleetGrid;

    if (room.gameState.fleets.P1 && room.gameState.fleets.P2) {
      room.gameState.currentTurn = 'P1';
      io.to(socket.currentRoom).emit('tank-battle-start', {
        currentTurn: 'P1'
      });
    } else {
      socket.emit('tank-waiting-opponent');
    }
  });

  socket.on('tank-fire-strike', (data) => {
    const room = rooms.get(socket.currentRoom);
    if (!room) return;
    socket.to(socket.currentRoom).emit('tank-incoming-strike', data);
  });

  socket.on('tank-strike-result', (data) => {
    const room = rooms.get(socket.currentRoom);
    if (!room) return;

    room.gameState.currentTurn = room.gameState.currentTurn === 'P1' ? 'P2' : 'P1';
    io.to(socket.currentRoom).emit('tank-strike-resolved', {
      attackerRole: data.attackerRole,
      x: data.x,
      y: data.y,
      hit: data.hit,
      destroyedUnit: data.destroyedUnit,
      allDestroyed: data.allDestroyed,
      nextTurn: room.gameState.currentTurn
    });
  });

  // ==================== GAME 4: TUG-OF-WAR EVENTS ====================
  socket.on('tug-mash-pull', (data) => {
    const room = rooms.get(socket.currentRoom);
    if (!room) return;

    const pullForce = data.force || 1.5;
    if (data.role === 'P1') {
      room.gameState.ropePos = Math.max(0, room.gameState.ropePos - pullForce);
    } else {
      room.gameState.ropePos = Math.min(100, room.gameState.ropePos + pullForce);
    }

    let winner = null;
    if (room.gameState.ropePos <= 5) winner = 'P1';
    else if (room.gameState.ropePos >= 95) winner = 'P2';

    io.to(socket.currentRoom).emit('tug-state-sync', {
      ropePos: room.gameState.ropePos,
      winner
    });
  });

  socket.on('tug-special-surge', (data) => {
    const room = rooms.get(socket.currentRoom);
    if (!room) return;

    const surgeForce = data.force || 8;
    if (data.role === 'P1') {
      room.gameState.ropePos = Math.max(0, room.gameState.ropePos - surgeForce);
    } else {
      room.gameState.ropePos = Math.min(100, room.gameState.ropePos + surgeForce);
    }

    io.to(socket.currentRoom).emit('tug-surge-effect', {
      role: data.role,
      ropePos: room.gameState.ropePos
    });
  });

  // ==================== GAME 5: LASER MAZE EVENTS ====================
  socket.on('laser-agent-sync', (data) => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('laser-agent-sync', data);
  });

  socket.on('laser-operator-toggle', (data) => {
    if (!socket.currentRoom) return;
    io.to(socket.currentRoom).emit('laser-trap-toggled', data);
  });

  socket.on('laser-key-found', (data) => {
    if (!socket.currentRoom) return;
    io.to(socket.currentRoom).emit('laser-key-revealed', data);
  });

  socket.on('laser-defuse-code', (data) => {
    if (!socket.currentRoom) return;
    io.to(socket.currentRoom).emit('laser-defuse-result', data);
  });

  // Generic Relay Event
  socket.on('game-relay', (data) => {
    if (!socket.currentRoom) return;
    socket.to(socket.currentRoom).emit('game-relay', data);
  });
});

function handleLeaveRoom(socket) {
  const roomCode = socket.currentRoom;
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (room) {
    room.players = room.players.filter(p => p.id !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(roomCode);
      console.log(`[Room Deleted] Code: ${roomCode}`);
    } else {
      room.status = 'waiting';
      room.players[0].role = 'P1';
      room.players[0].ready = false;
      io.to(roomCode).emit('player-left', {
        message: 'Opponent disconnected or left the room.',
        room
      });
    }
    io.emit('rooms-updated');
  }
  socket.leave(roomCode);
  socket.currentRoom = null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` NEON MULTIPLAYER ARCADE PORTAL RUNNING ON PORT ${PORT} `);
  console.log(` http://localhost:${PORT}`);
  console.log(`====================================================`);
});
