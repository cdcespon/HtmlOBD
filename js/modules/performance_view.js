/**
 * ApexOBD - PerformanceView (Agente 5 - Inspiración RaceChrono + Car Scanner Terminal)
 * Cronómetro de aceleración (0-100, 1/4 milla), gráfica multicanal y terminal serie/OBD.
 */
import { stateStore } from '../core/state_store.js';
import { eventBus } from '../core/event_bus.js';

export class PerformanceView {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options; // { onSendCommand }

    // Estado del cronómetro de aceleración
    this.drag = {
      status: 'IDLE', // 'IDLE' | 'READY' | 'RUNNING' | 'FINISHED'
      startTime: 0,
      t0to100: null,
      tQuarterMile: null,
      distanceMeters: 0,
      lastTickTime: 0,
      topSpeed: 0
    };

    // Buffer de telemetría para gráfica multicanal y exportación
    this.history = [];
    this.maxHistoryLength = 120; // 120 muestras en el gráfico continuo

    this._buildLayout();
    this._initElements();
    this._bindEvents();

    this.unsubscribeStore = stateStore.subscribe(() => this._onStateUpdate());
    this.unsubscribeBus = eventBus.on('terminal:packet', (pkt) => this._appendTerminal(pkt));
  }

  _buildLayout() {
    this.container.innerHTML = `
      <div class="perf-container">
        <div class="perf-header">
          <div class="perf-title">🏁 Performance Lab & Análisis de Pista</div>
          <div class="export-actions">
            <button class="perf-btn" id="btn-export-csv">📥 Exportar CSV</button>
            <button class="perf-btn" id="btn-export-json">📥 Exportar JSON</button>
            <button class="perf-btn" id="btn-reset-drag">↺ Reiniciar Timer</button>
          </div>
        </div>

        <!-- Tarjetas de Aceleración -->
        <div class="drag-timer-grid">
          <div class="drag-card">
            <span class="drag-status-badge" id="badge-drag-status">IDLE</span>
            <div class="drag-label">0 - 100 KM/H</div>
            <div class="drag-time" id="val-0-100">-- s</div>
          </div>
          <div class="drag-card">
            <div class="drag-label">1/4 DE MILLA (400 M)</div>
            <div class="drag-time" id="val-quarter">-- s</div>
          </div>
          <div class="drag-card">
            <div class="drag-label">TIEMPO ACTUAL</div>
            <div class="drag-time" id="val-current-time" style="color:#f59e0b;">0.00 s</div>
          </div>
          <div class="drag-card">
            <div class="drag-label">VELOCIDAD MÁXIMA</div>
            <div class="drag-time" id="val-top-speed" style="color:#10b981;">0 km/h</div>
          </div>
        </div>

        <!-- Gráfica Continua Multicanal -->
        <div class="chart-card">
          <div class="chart-header">
            <span style="font-size:0.9rem; font-weight:700; color:#f8fafc;">Telemetría Multicanal en Tiempo Real</span>
            <div class="chart-legend">
              <div class="legend-item"><span class="legend-dot" style="background:#38bdf8;"></span> Velocidad (km/h)</div>
              <div class="legend-item"><span class="legend-dot" style="background:#a855f7;"></span> RPM (/40)</div>
              <div class="legend-item"><span class="legend-dot" style="background:#eab308;"></span> Acelerador (%)</div>
              <div class="legend-item"><span class="legend-dot" style="background:#ec4899;"></span> Boost (bar*100)</div>
            </div>
          </div>
          <canvas class="timeline-canvas" id="perf-canvas" width="900" height="180"></canvas>
        </div>

        <!-- Consola de Ingeniería y Terminal Serie -->
        <div class="terminal-card">
          <div class="terminal-title-bar">
            <span>💻 Terminal Serie / Sniffer OBD2 (Car Scanner Console)</span>
            <div class="quick-commands">
              <span class="quick-cmd-chip" data-cmd="ATZ">ATZ</span>
              <span class="quick-cmd-chip" data-cmd="ATRV">ATRV</span>
              <span class="quick-cmd-chip" data-cmd="0100">0100</span>
              <span class="quick-cmd-chip" data-cmd="010C">010C (RPM)</span>
              <span class="quick-cmd-chip" data-cmd="010D">010D (Speed)</span>
              <span class="quick-cmd-chip" data-cmd="0902">0902 (VIN)</span>
            </div>
          </div>
          <div class="terminal-output" id="term-output"></div>
          <div class="terminal-input-row">
            <input type="text" class="terminal-input" id="term-input" placeholder="Ingresa comando AT o PID hexadecimal (ej: 010C, ATZ)...">
            <button class="terminal-send-btn" id="term-send">Enviar</button>
          </div>
        </div>
      </div>
    `;
  }

  _initElements() {
    this.badgeStatus = this.container.querySelector('#badge-drag-status');
    this.val0to100 = this.container.querySelector('#val-0-100');
    this.valQuarter = this.container.querySelector('#val-quarter');
    this.valCurrentTime = this.container.querySelector('#val-current-time');
    this.valTopSpeed = this.container.querySelector('#val-top-speed');

    this.canvas = this.container.querySelector('#perf-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.termOutput = this.container.querySelector('#term-output');
    this.termInput = this.container.querySelector('#term-input');
    this.btnSend = this.container.querySelector('#term-send');

    this.btnExportCsv = this.container.querySelector('#btn-export-csv');
    this.btnExportJson = this.container.querySelector('#btn-export-json');
    this.btnResetDrag = this.container.querySelector('#btn-reset-drag');
  }

  _bindEvents() {
    this.btnSend.addEventListener('click', () => this._sendTerminalCommand());
    this.termInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._sendTerminalCommand();
    });

    this.container.querySelectorAll('.quick-cmd-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd');
        this.termInput.value = cmd;
        this._sendTerminalCommand();
      });
    });

    this.btnResetDrag.addEventListener('click', () => {
      this.drag = {
        status: 'IDLE',
        startTime: 0,
        t0to100: null,
        tQuarterMile: null,
        distanceMeters: 0,
        lastTickTime: 0,
        topSpeed: 0
      };
      this.val0to100.textContent = '-- s';
      this.valQuarter.textContent = '-- s';
      this.valCurrentTime.textContent = '0.00 s';
      this.valTopSpeed.textContent = '0 km/h';
      this.badgeStatus.textContent = 'IDLE';
      this.badgeStatus.className = 'drag-status-badge';
    });

    this.btnExportCsv.addEventListener('click', () => this._exportCSV());
    this.btnExportJson.addEventListener('click', () => this._exportJSON());
  }

  _sendTerminalCommand() {
    const cmd = this.termInput.value.trim();
    if (!cmd) return;
    this.termInput.value = '';

    if (this.options.onSendCommand) {
      this.options.onSendCommand(cmd);
    }
  }

  _appendTerminal(packet) {
    if (!this.termOutput) return;
    const time = new Date(packet.timestamp).toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `terminal-line ${packet.direction.toLowerCase()}`;
    line.textContent = `[${time}] ${packet.direction}: ${packet.raw.trim()}`;
    this.termOutput.appendChild(line);
    this.termOutput.scrollTop = this.termOutput.scrollHeight;
  }

  _onStateUpdate() {
    const telem = stateStore.getState().telemetry;
    const speed = telem.speed || 0;
    const now = performance.now();

    // Actualiza velocidad máxima
    if (speed > this.drag.topSpeed) {
      this.drag.topSpeed = speed;
      this.valTopSpeed.textContent = `${Math.round(this.drag.topSpeed)} km/h`;
    }

    // Lógica del Drag Timer
    this._processDragTimer(speed, now);

    // Guarda muestra de telemetría para gráfica y exportador
    this.history.push({
      timestamp: Date.now(),
      speed: telem.speed,
      rpm: telem.rpm,
      throttle: telem.throttle,
      boost: telem.boost
    });

    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }

    this._drawTimeline();
  }

  _processDragTimer(speed, now) {
    // Si el auto está detenido (speed === 0), armar el timer
    if (speed < 1 && this.drag.status !== 'RUNNING') {
      this.drag.status = 'READY';
      this.badgeStatus.textContent = 'LISTO';
      this.badgeStatus.className = 'drag-status-badge ready';
      this.drag.distanceMeters = 0;
      this.drag.lastTickTime = now;
      return;
    }

    // Si estaba LISTO y detecta aceleración (> 1.5 km/h), inicia la tirada
    if (this.drag.status === 'READY' && speed >= 1.5) {
      this.drag.status = 'RUNNING';
      this.drag.startTime = now;
      this.drag.lastTickTime = now;
      this.drag.distanceMeters = 0;
      this.badgeStatus.textContent = 'EN CARRERA';
      this.badgeStatus.className = 'drag-status-badge running';
    }

    // Si está en carrera
    if (this.drag.status === 'RUNNING') {
      const elapsedSeconds = (now - this.drag.startTime) / 1000;
      this.valCurrentTime.textContent = `${elapsedSeconds.toFixed(2)} s`;

      // Integración numérica de distancia: d += (v / 3.6) * dt
      const dt = (now - this.drag.lastTickTime) / 1000;
      this.drag.distanceMeters += (speed / 3.6) * dt;
      this.drag.lastTickTime = now;

      // Registro de 0 - 100 km/h
      if (speed >= 100 && !this.drag.t0to100) {
        this.drag.t0to100 = elapsedSeconds;
        this.val0to100.textContent = `${elapsedSeconds.toFixed(2)} s`;
      }

      // Registro de 1/4 de milla (~402 metros)
      if (this.drag.distanceMeters >= 402 && !this.drag.tQuarterMile) {
        this.drag.tQuarterMile = elapsedSeconds;
        this.valQuarter.textContent = `${elapsedSeconds.toFixed(2)} s`;
        this.drag.status = 'FINISHED';
        this.badgeStatus.textContent = 'FINALIZADO';
        this.badgeStatus.className = 'drag-status-badge ready';
      }
    }
  }

  _drawTimeline() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.history.length < 2) return;

    // Cuadrícula de fondo
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let y = 30; y < h; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const step = w / (this.maxHistoryLength - 1);
    const startX = w - (this.history.length * step);

    // Canales a graficar: { prop, scale, color }
    const channels = [
      { prop: 'speed', scale: 260, color: '#38bdf8' },
      { prop: 'rpm', scale: 8000, color: '#a855f7' },
      { prop: 'throttle', scale: 100, color: '#eab308' },
      { prop: 'boost', scale: 2.0, color: '#ec4899' }
    ];

    channels.forEach(ch => {
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = ch.color;

      this.history.forEach((sample, i) => {
        const x = startX + (i * step);
        const val = sample[ch.prop] || 0;
        const norm = Math.min(1, Math.max(0, val / ch.scale));
        const y = h - 10 - (norm * (h - 25));

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }

  _exportCSV() {
    if (this.history.length === 0) {
      alert('No hay datos registrados aún');
      return;
    }
    const headers = 'Timestamp,Velocidad(km/h),RPM,Acelerador(%),Boost(bar)\n';
    const rows = this.history.map(h => `${new Date(h.timestamp).toISOString()},${h.speed},${h.rpm},${h.throttle},${h.boost}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    this._downloadBlob(blob, `apex_obd_telemetry_${Date.now()}.csv`);
  }

  _exportJSON() {
    if (this.history.length === 0) {
      alert('No hay datos registrados aún');
      return;
    }
    const blob = new Blob([JSON.stringify(this.history, null, 2)], { type: 'application/json' });
    this._downloadBlob(blob, `apex_obd_telemetry_${Date.now()}.json`);
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  destroy() {
    if (this.unsubscribeStore) this.unsubscribeStore();
    if (this.unsubscribeBus) this.unsubscribeBus();
    this.container.innerHTML = '';
  }
}
