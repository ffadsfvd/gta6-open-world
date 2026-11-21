// Keyboard and mouse state for one frame: which actions are held, which were pressed this
// frame, and how far the mouse moved. Mouse look uses pointer lock, with click-drag as a fallback.

export const ACTIONS = {
  forward: ['KeyW'],
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  lookLeft: ['ArrowLeft'],
  lookRight: ['ArrowRight'],
  lookUp: ['ArrowUp'],
  lookDown: ['ArrowDown'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  handbrake: ['Space'],
  enterVehicle: ['KeyF'],
  interact: ['KeyE'],
  reload: ['KeyR'],
  horn: ['KeyH'],
  cameraMode: ['KeyV'],
  lookBack: ['KeyC'],
  nextWeapon: ['KeyQ'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  taxi: ['KeyT'],
  radio: ['KeyN'],
  map: ['KeyM'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter'],
};

const BUTTON_FIRE = 1;
const BUTTON_AIM = 2;
const BLOCKED_DEFAULTS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.buttons = 0;
    this.buttonsPressed = 0;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.pointerLocked = false;
    this.wantsLock = false;
    this.onLockLost = null;
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', (event) => {
      if (BLOCKED_DEFAULTS.has(event.code) && this.wantsLock) event.preventDefault();
      if (!this.down.has(event.code)) this.pressed.add(event.code);
      this.down.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.down.delete(event.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.buttons = 0;
    });
    this.canvas.addEventListener('mousedown', (event) => {
      const bit = event.button === 0 ? BUTTON_FIRE : event.button === 2 ? BUTTON_AIM : 0;
      this.buttons |= bit;
      this.buttonsPressed |= bit;
      if (this.wantsLock && !this.pointerLocked) this.requestLock();
    });
    window.addEventListener('mouseup', (event) => {
      const bit = event.button === 0 ? BUTTON_FIRE : event.button === 2 ? BUTTON_AIM : 0;
      this.buttons &= ~bit;
    });
    window.addEventListener('mousemove', (event) => {
      if (this.pointerLocked || this.buttons !== 0) {
        this.mouseDX += event.movementX || 0;
        this.mouseDY += event.movementY || 0;
      }
    });
    window.addEventListener('wheel', (event) => {
      this.wheel += Math.sign(event.deltaY);
    }, { passive: true });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      const lost = this.pointerLocked && !locked;
      this.pointerLocked = locked;
      if (lost && this.onLockLost) this.onLockLost();
    });
  }

  requestLock() {
    try {
      const result = this.canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      // Pointer lock can be refused (automation, iframes): click-drag look still works.
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(action) {
    if (action === 'fire') return (this.buttons & BUTTON_FIRE) !== 0;
    if (action === 'aim') return (this.buttons & BUTTON_AIM) !== 0;
    const codes = ACTIONS[action];
    for (let index = 0; index < codes.length; index += 1) if (this.down.has(codes[index])) return true;
    return false;
  }

  wasPressed(action) {
    if (action === 'fire') return (this.buttonsPressed & BUTTON_FIRE) !== 0;
    const codes = ACTIONS[action];
    for (let index = 0; index < codes.length; index += 1) if (this.pressed.has(codes[index])) return true;
    return false;
  }

  /** -1, 0 or 1 from two opposing actions. */
  axis(negative, positive) {
    return (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0);
  }

  takeMouse() {
    const delta = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return delta;
  }

  endFrame() {
    this.pressed.clear();
    this.buttonsPressed = 0;
    this.wheel = 0;
  }
}
