// Sleek AAA Gaming Pointer Cursor Engine (100% Non-Blocking)

class GamingCursor {
  constructor() {
    this.isTouchDevice = ('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (this.isTouchDevice) return;

    this.pos = { x: -100, y: -100 };
    this.target = { x: -100, y: -100 };
    this.ringPos = { x: -100, y: -100 };

    this.initDOM();
    this.initEvents();
    this.render();
  }

  initDOM() {
    // Center Gaming Dot
    this.dot = document.createElement('div');
    this.dot.id = 'custom-cursor-dot';

    // Outer Gaming Ring
    this.ring = document.createElement('div');
    this.ring.id = 'custom-cursor-ring';

    document.body.appendChild(this.dot);
    document.body.appendChild(this.ring);
  }

  initEvents() {
    window.addEventListener('mousemove', (e) => {
      this.target.x = e.clientX;
      this.target.y = e.clientY;
    });

    window.addEventListener('mousedown', () => {
      if (this.ring) this.ring.classList.add('clicking');
      this.spawnRipple(this.target.x, this.target.y);
    });

    window.addEventListener('mouseup', () => {
      if (this.ring) this.ring.classList.remove('clicking');
    });

    // Delegated Hover Detection for interactive elements
    const interactiveSelector = 'button, a, input, select, textarea, .game-card, .btn-neon, .btn-secondary, .room-chip, .modal-close, .user-badge, .brand, .theme-toggle-btn, [role="button"]';

    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactiveSelector)) {
        if (this.ring) this.ring.classList.add('hovering');
        if (this.dot) this.dot.classList.add('hovering');
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactiveSelector)) {
        if (this.ring) this.ring.classList.remove('hovering');
        if (this.dot) this.dot.classList.remove('hovering');
      }
    });
  }

  spawnRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'cursor-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);

    setTimeout(() => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 450);
  }

  render() {
    if (this.isTouchDevice) return;

    // Instant Dot
    this.pos.x = this.target.x;
    this.pos.y = this.target.y;
    this.dot.style.transform = `translate3d(${this.pos.x}px, ${this.pos.y}px, 0)`;

    // Smooth Ring LERP Physics
    const lerpFactor = 0.25;
    this.ringPos.x += (this.target.x - this.ringPos.x) * lerpFactor;
    this.ringPos.y += (this.target.y - this.ringPos.y) * lerpFactor;

    this.ring.style.transform = `translate3d(${this.ringPos.x}px, ${this.ringPos.y}px, 0)`;

    requestAnimationFrame(() => this.render());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.gamingCursor = new GamingCursor();
});
