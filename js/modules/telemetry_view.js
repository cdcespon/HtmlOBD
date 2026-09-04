/**
 * ApexOBD - TelemetryView (Agente 3 - Inspiración BimmerLink)
 * Cuadrícula de tarjetas de sensores de alta legibilidad, seguimiento de picos (min/max),
 * alertas por umbral y micro-gráficos sparkline en tiempo real.
 */
import { stateStore } from '../core/state_store.js';

export class TelemetryView {
  constructor(containerElement) {
    this.container = containerElement;
    this.sparklineHistory = new Map(); // id -> array de valores recientes
    this.minMaxHistory = new Map();    // id -> { min, max }
    this.historyLength = 35;           // cantidad de puntos en sparkline

    this.sensorDefs = [
      { id: 'rpm', label: 'Régimen de Giro', unit: 'RPM', warn: 6200, crit: 7000, decimals: 0, color: '#38bdf8' },
      { id: 'speed', label: 'Velocidad de Rueda', unit: 'km/h', warn: 140, crit: 180, decimals: 0, color: '#38bdf8' },
      { id: 'coolantTemp', label: 'Temp. Refrigerante', unit: '°C', warn: 96, crit: 104, decimals: 1, color: '#10b981' },
      { id: 'oilTemp', label: 'Temp. Aceite Motor', unit: '°C', warn: 105, crit: 118, decimals: 1, color: '#f59e0b' },
      { id: 'boost', label: 'Presión de Turbo (Boost)', unit: 'bar', warn: 1.1, crit: 1.35, decimals: 2, color: '#a855f7' },
      { id: 'intakeTemp', label: 'Temp. Admisión (IAT)', unit: '°C', warn: 50, crit: 65, decimals: 1, color: '#06b6d4' },
      { id: 'throttle', label: 'Pedal / Acelerador', unit: '%', warn: 85, crit: 98, decimals: 0, color: '#eab308' },
      { id: 'load', label: 'Carga del Motor', unit: '%', warn: 85, crit: 95, decimals: 0, color: '#6366f1' },
      { id: 'maf', label: 'Flujo de Aire (MAF)', unit: 'g/s', warn: 180, crit: 220, decimals: 1, color: '#3b82f6' },
      { id: 'fuelLevel', label: 'Nivel de Combustible', unit: '%', warn: 15, crit: 8, isLowerCrit: true, decimals: 0, color: '#ec4899' }
    ];

    this._initHistories();
    this._buildLayout();
    this._initElements();
    this._bindEvents();

    this.unsubscribe = stateStore.subscribe(() => this.update());
  }

  _initHistories() {
    this.sensorDefs.forEach(s => {
      this.sparklineHistory.set(s.id, new Array(this.historyLength).fill(0));
      this.minMaxHistory.set(s.id, { min: Infinity, max: -Infinity });
    });
  }

  _buildLayout() {
    const cardsHtml = this.sensorDefs.map(s => `
      <div class="sensor-card" id="card-${s.id}">
        <div class="card-top">
          <span class="sensor-label">${s.label}</span>
          <span class="sensor-badge" id="badge-${s.id}">NORMAL</span>
        </div>
        <div class="card-main">
          <span class="sensor-value" id="val-${s.id}">--</span>
          <span class="sensor-unit">${s.unit}</span>
        </div>
        <div class="card-minmax">
          <span>MIN: <b id="min-${s.id}">--</b></span>
          <span>MAX: <b id="max-${s.id}">--</b></span>
        </div>
        <canvas class="sparkline-canvas" id="spark-${s.id}" width="260" height="48"></canvas>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div class="telemetry-container">
        <div class="telemetry-header">
          <div class="telemetry-title">
            <span>⚡ Telemetría de Sensores en Vivo</span>
          </div>
          <div class="telemetry-actions">
            <button class="telemetry-btn" id="btn-reset-minmax">Reset Min/Max</button>
          </div>
        </div>
        <div class="telemetry-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  _initElements() {
    this.elements = {};
    this.sensorDefs.forEach(s => {
      this.elements[s.id] = {
        card: this.container.querySelector(`#card-${s.id}`),
        badge: this.container.querySelector(`#badge-${s.id}`),
        value: this.container.querySelector(`#val-${s.id}`),
        min: this.container.querySelector(`#min-${s.id}`),
        max: this.container.querySelector(`#max-${s.id}`),
        canvas: this.container.querySelector(`#spark-${s.id}`),
        ctx: this.container.querySelector(`#spark-${s.id}`).getContext('2d')
      };
    });

    const resetBtn = this.container.querySelector('#btn-reset-minmax');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.sensorDefs.forEach(s => {
          this.minMaxHistory.set(s.id, { min: Infinity, max: -Infinity });
        });
        this.update();
      });
    }
  }

  _bindEvents() {}

  update() {
    const telem = stateStore.getState().telemetry;

    this.sensorDefs.forEach(s => {
      const rawVal = telem[s.id] !== undefined ? telem[s.id] : 0;
      const numVal = parseFloat(rawVal);
      const el = this.elements[s.id];
      if (!el) return;

      // Actualiza valor actual
      el.value.textContent = numVal.toFixed(s.decimals);

      // Actualiza Min / Max
      const mm = this.minMaxHistory.get(s.id);
      if (numVal < mm.min) mm.min = numVal;
      if (numVal > mm.max) mm.max = numVal;
      el.min.textContent = mm.min === Infinity ? '--' : mm.min.toFixed(s.decimals);
      el.max.textContent = mm.max === -Infinity ? '--' : mm.max.toFixed(s.decimals);

      // Alertas por umbral
      el.card.classList.remove('warning', 'critical');
      el.badge.className = 'sensor-badge';
      
      let status = 'NORMAL';
      if (s.isLowerCrit) {
        if (numVal <= s.crit) {
          status = 'CRÍTICO';
          el.card.classList.add('critical');
          el.badge.classList.add('crit');
        } else if (numVal <= s.warn) {
          status = 'ATENCIÓN';
          el.card.classList.add('warning');
          el.badge.classList.add('warn');
        }
      } else {
        if (numVal >= s.crit) {
          status = 'CRÍTICO';
          el.card.classList.add('critical');
          el.badge.classList.add('crit');
        } else if (numVal >= s.warn) {
          status = 'ATENCIÓN';
          el.card.classList.add('warning');
          el.badge.classList.add('warn');
        }
      }
      el.badge.textContent = status;

      // Actualiza historial del sparkline
      const hist = this.sparklineHistory.get(s.id);
      hist.push(numVal);
      if (hist.length > this.historyLength) {
        hist.shift();
      }

      this._drawSparkline(el.ctx, el.canvas, hist, s.color);
    });
  }

  _drawSparkline(ctx, canvas, data, color) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (data.length < 2) return;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = (max - min) === 0 ? 1 : (max - min);

    // Fondo tenue
    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.fillRect(0, 0, w, h);

    // Trazado de línea
    ctx.beginPath();
    const step = w / (data.length - 1);
    data.forEach((val, i) => {
      const x = i * step;
      const y = h - 6 - ((val - min) / range) * (h - 12);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();

    // Relleno suave con gradiente vertical
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color.replace(')', ', 0.25)').replace('rgb', 'rgba'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}
