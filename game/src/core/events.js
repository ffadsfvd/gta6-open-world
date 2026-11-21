// A tiny publish/subscribe bus. Systems announce what happened (a crime, a gunshot, a car
// exploding, a mission passed) and others react without importing each other.

export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(name, handler) {
    if (!this.handlers.has(name)) this.handlers.set(name, []);
    this.handlers.get(name).push(handler);
    return () => this.off(name, handler);
  }

  off(name, handler) {
    const list = this.handlers.get(name);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  emit(name, payload) {
    const list = this.handlers.get(name);
    if (!list) return;
    for (let index = 0; index < list.length; index += 1) list[index](payload);
  }
}
