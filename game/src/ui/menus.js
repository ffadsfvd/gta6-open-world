// Menus: the title screen (Continue, New Game, Controls, Settings), the pause menu (Resume,
// Map, Stats, Settings, Controls, Save, Quit), and their sub-panels. Mouse or arrow keys and
// Enter; Escape goes back.
import { GAME_TITLE } from '../core/config.js';
import { STAT_LABELS } from '../progression/progress.js';
import { formatMoney } from '../core/mathUtils.js';

const CONTROLS = [
  ['W A S D', 'Move / drive'], ['Mouse', 'Look around (click to capture)'], ['Shift', 'Sprint'],
  ['Space', 'Jump / handbrake'], ['F', 'Enter, exit or steal a vehicle'], ['Right mouse', 'Aim'],
  ['Left mouse', 'Shoot / punch'], ['Q · 1 2 3 · wheel', 'Switch weapon'], ['R', 'Reload'],
  ['E', 'Talk, start missions, shop'], ['H', 'Horn'], ['V', 'Car camera view'], ['C', 'Look behind'],
  ['N', 'Change radio station'], ['T', 'Taxi fares (in a taxi)'], ['M', 'City map'], ['Esc / P', 'Pause'],
];

function button(label, action, { disabled = false, detail = '' } = {}) {
  return { label, action, disabled, detail };
}

export class Menus {
  constructor(game) {
    this.game = game;
    this.title = document.getElementById('start-screen');
    this.pause = document.getElementById('pause-menu');
    this.active = null;
    this.items = [];
    this.focus = 0;
  }

  get open() {
    return this.active !== null;
  }

  render(container, html, items) {
    container.innerHTML = html;
    const list = container.querySelector('.menu-list');
    this.items = items;
    this.focus = Math.max(0, items.findIndex((item) => !item.disabled));
    if (list) {
      items.forEach((item, index) => {
        const element = document.createElement('button');
        element.className = 'menu-button';
        element.disabled = item.disabled;
        element.innerHTML = `<span>${item.label}</span>${item.detail ? `<small>${item.detail}</small>` : ''}`;
        element.addEventListener('mouseenter', () => this.setFocus(index));
        element.addEventListener('click', () => this.choose(index));
        list.appendChild(element);
      });
    }
    this.setFocus(this.focus);
  }

  setFocus(index) {
    this.focus = index;
    const container = this.active === 'title' ? this.title : this.pause;
    container.querySelectorAll('.menu-button').forEach((element, i) => element.classList.toggle('focus', i === index));
  }

  choose(index) {
    const item = this.items[index];
    if (!item || item.disabled) return;
    this.game.audio.unlock();
    this.game.events.emit('uiSelect', {});
    item.action();
  }

  handleInput(input) {
    if (!this.active) return;
    const step = (input.wasPressed('lookDown') || input.wasPressed('back') ? 1 : 0) - (input.wasPressed('lookUp') || input.wasPressed('forward') ? 1 : 0);
    if (step !== 0 && this.items.length) {
      let next = this.focus;
      do next = (next + step + this.items.length) % this.items.length;
      while (this.items[next].disabled && next !== this.focus);
      this.setFocus(next);
      this.game.events.emit('uiClick', {});
    }
    if (input.wasPressed('confirm') || input.wasPressed('jump')) this.choose(this.focus);
    else if (input.wasPressed('pause') && this.onBack) this.onBack();
  }

  showTitle() {
    const game = this.game;
    this.active = 'title';
    this.title.classList.remove('hidden');
    this.onBack = null;
    const hasSave = game.save.exists();
    this.render(this.title, `
      <div class="title-card">
        <div class="logo"><span class="logo-top">SOLMARA</span><span class="logo-bottom">HEAT</span></div>
        <p class="tagline">Sun, sea and bad decisions on the Atlantic coast</p>
        <div class="menu-list"></div>
        <p class="title-footer">An original open-world crime story · every name, place and tune is invented for this game</p>
      </div>`, [
      button('Continue', () => game.continueGame(), { disabled: !hasSave, detail: hasSave ? game.save.summary() : 'No saved game yet' }),
      button('New Game', () => game.newGame()),
      button('Controls', () => this.showPanel(this.title, 'Controls', this.controlsHtml(), () => this.showTitle())),
      button('Settings', () => this.showSettings(this.title, () => this.showTitle())),
    ]);
    document.title = GAME_TITLE;
  }

  hideTitle() {
    this.title.classList.add('hidden');
    if (this.active === 'title') this.active = null;
  }

  showPause() {
    const game = this.game;
    this.active = 'pause';
    this.pause.classList.remove('hidden');
    this.onBack = () => game.resume();
    this.render(this.pause, `
      <div class="pause-card">
        <h2>PAUSED</h2>
        <p class="pause-sub">${game.missions.active ? `Mission: ${game.missions.current.def.title}` : 'Free roam'} · ${formatMoney(game.progress.money)}</p>
        <div class="menu-list"></div>
      </div>`, [
      button('Resume', () => game.resume()),
      button('City Map', () => {
        game.resume();
        game.openMap();
      }),
      button('Stats', () => this.showPanel(this.pause, 'Stats', this.statsHtml(), () => this.showPause())),
      button('Settings', () => this.showSettings(this.pause, () => this.showPause())),
      button('Controls', () => this.showPanel(this.pause, 'Controls', this.controlsHtml(), () => this.showPause())),
      button('Save Game', () => {
        game.save.save();
        game.notifications.toast('Game saved', '', 2.5);
        game.resume();
      }, { disabled: game.missions.active, detail: game.missions.active ? 'Finish the mission first' : '' }),
      button('Quit to Title', () => game.quitToTitle()),
    ]);
  }

  hidePause() {
    this.pause.classList.add('hidden');
    if (this.active === 'pause') this.active = null;
  }

  showPanel(container, heading, body, back) {
    this.onBack = back;
    this.render(container, `<div class="panel-card"><h2>${heading}</h2>${body}<div class="menu-list"></div></div>`, [button('Back', back)]);
  }

  controlsHtml() {
    return `<table class="controls">${CONTROLS.map(([key, what]) => `<tr><td><kbd>${key}</kbd></td><td>${what}</td></tr>`).join('')}</table>`;
  }

  statsHtml() {
    const stats = this.game.progress.stats;
    return `<table class="controls">${Object.entries(STAT_LABELS).map(([key, label]) => {
      let value = stats[key] ?? 0;
      if (key === 'earned') value = formatMoney(value);
      else if (key === 'distanceDriven') value = (value / 1000).toFixed(1);
      else if (key === 'playTime') value = Math.round(value / 60);
      return `<tr><td>${label}</td><td><b>${value}</b></td></tr>`;
    }).join('')}</table>`;
  }

  showSettings(container, back) {
    const game = this.game;
    const s = game.settings;
    this.onBack = back;
    const pct = (value) => `${Math.round(value * 100)}%`;
    const cycle = (key, values) => {
      const index = values.indexOf(s[key]);
      s[key] = values[(index + 1) % values.length];
      game.applySettings();
      this.showSettings(container, back);
    };
    const step = (key, delta, min, max) => {
      s[key] = Math.round(Math.min(max, Math.max(min, s[key] + delta)) * 100) / 100;
      game.applySettings();
      this.showSettings(container, back);
    };
    const focus = this.focus;
    this.render(container, '<div class="panel-card"><h2>Settings</h2><p class="pause-sub">Enter or click to change</p><div class="menu-list"></div></div>', [
      button(`Master volume: ${pct(s.masterVolume)}`, () => step('masterVolume', s.masterVolume >= 1 ? -1 : 0.1, 0, 1)),
      button(`Music volume: ${pct(s.musicVolume)}`, () => step('musicVolume', s.musicVolume >= 1 ? -1 : 0.1, 0, 1)),
      button(`Effects volume: ${pct(s.sfxVolume)}`, () => step('sfxVolume', s.sfxVolume >= 1 ? -1 : 0.1, 0, 1)),
      button(`Mouse sensitivity: ${s.sensitivity.toFixed(1)}x`, () => step('sensitivity', s.sensitivity >= 2 ? -1.5 : 0.25, 0.5, 2)),
      button(`Invert mouse Y: ${s.invertY ? 'On' : 'Off'}`, () => cycle('invertY', [false, true])),
      button(`Camera shake: ${s.shake ? 'On' : 'Off'}`, () => cycle('shake', [true, false])),
      button(`Graphics: ${s.quality === 'high' ? 'High (shadows)' : 'Low (faster)'}`, () => cycle('quality', ['high', 'low']), { detail: 'Takes effect after a reload' }),
      button('Back', back),
    ]);
    this.setFocus(Math.min(focus, this.items.length - 1));
  }
}
