/**
 * ApexOBD - CockpitView (Agente 2 - Inspiración RealDash)
 * Renderizado en Canvas 2D a 60 FPS de tacómetro deportivo, velocímetro,
 * barra de luces de cambio (shift lights), barrido de encendido y modo HUD.
 */
import { stateStore } from '../core/state_store.js';

export class CockpitView {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
    this.isHudActive = false;
    this.isSweeping = true;
    this.sweepProgress = 0;
    this.sweepDirection = 1; // 1 = sube, -1 = baja

    // Valores interpolados para animación fluida a 60 FPS
    this.animatedRpm = 0;
    this.animatedSpeed = 0;

    this.rafId = null;
    this._buildLayout();
    this._initCanvases();
    this._bindEvents();
    this._startRenderLoop();
  }

  _buildLayout() {
    this.container.innerHTML = `
      <div class="cockpit-container" id="cockpit-root">
        <div class="cockpit-toolbar">
          <div class="shift-light-bar" id="shift-bar">
            <div class="shift-led green" id="led-1"></div>
            <div class="shift-led green" id="led-2"></div>
            <div class="shift-led yellow" id="led-3"></div>
            <div class="shift-led yellow" id="led-4"></div>
            <div class="shift-led red" id="led-5"></div>
          </div>
          <button class="hud-toggle-btn" id="hud-btn" title="Modo proyección en parabrisas">
            <span>⇄ MODO HUD</span>
          </button>
        </div>

        <div class="gauges-wrapper">
          <!-- Tacómetro (RPM) -->
          <div class="gauge-box">
            <canvas class="gauge-canvas" id="tach-canvas" width="600" height="600"></canvas>
            <div class="gear-badge" id="gear-display">1</div>
          </div>

          <!-- Velocímetro (km/h) -->
          <div class="gauge-box">
            <canvas class="gauge-canvas" id="speed-canvas" width="600" height="600"></canvas>
          </div>
        </div>

        <!-- Barra interactiva de control manual de acelerador (para pruebas en vivo) -->
        <div class="pedal-control-bar">
          <label style="font-size:0.85rem; color:#94a3b8; font-weight:600;">Pedal de Acelerador:</label>
          <input type="range" class="pedal-slider" id="throttle-pedal" min="0" max="100" value="0">
          <span id="throttle-val" style="font-family:monospace; color:#38bdf8; min-width:40px;">0%</span>
        </div>
      </div>
    `;
  }

  _initCanvases() {
    this.tachCanvas = this.container.querySelector('#tach-canvas');
    this.tachCtx = this.tachCanvas.getContext('2d');

    this.speedCanvas = this.container.querySelector('#speed-canvas');
    this.speedCtx = this.speedCanvas.getContext('2d');

    this.gearDisplay = this.container.querySelector('#gear-display');
    this.rootEl = this.container.querySelector('#cockpit-root');
    this.hudBtn = this.container.querySelector('#hud-btn');
    this.pedalInput = this.container.querySelector('#throttle-pedal');
    this.pedalVal = this.container.querySelector('#throttle-val');

    // LEDs
    this.leds = [
      this.container.querySelector('#led-1'),
      this.container.querySelector('#led-2'),
      this.container.querySelector('#led-3'),
      this.container.querySelector('#led-4'),
      this.container.querySelector('#led-5')
    ];
  }

  _bindEvents() {
    this.hudBtn.addEventListener('click', () => {
      this.isHudActive = !this.isHudActive;
      this.rootEl.classList.toggle('hud-mode', this.isHudActive);
      this.hudBtn.classList.toggle('active', this.isHudActive);
    });

    this.pedalInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.pedalVal.textContent = `${val}%`;
      if (this.options.onThrottleChange) {
        this.options.onThrottleChange(val);
      }
    });
  }

  /**
   * Dispara la ceremonia inicial de barrido de agujas (Gauge Sweep)
   */
  triggerSweep() {
    this.isSweeping = true;
    this.sweepProgress = 0;
    this.sweepDirection = 1;
  }

  _startRenderLoop() {
    const render = () => {
      this._updatePhysics();
      this._drawTachometer();
      this._drawSpeedometer();
      this._updateShiftLights();
      this.rafId = requestAnimationFrame(render);
    };
    this.rafId = requestAnimationFrame(render);
  }

  _updatePhysics() {
    const state = stateStore.getState();
    const targetRpm = state.telemetry.rpm;
    const targetSpeed = state.telemetry.speed;

    if (this.isSweeping) {
      this.sweepProgress += 0.025 * this.sweepDirection;
      if (this.sweepProgress >= 1.0) {
        this.sweepProgress = 1.0;
        this.sweepDirection = -1;
      } else if (this.sweepProgress <= 0.0) {
        this.sweepProgress = 0;
        this.isSweeping = false;
      }
      this.animatedRpm = this.sweepProgress * 8000;
      this.animatedSpeed = this.sweepProgress * 260;
    } else {
      // Interpolación suave (lerp)
      this.animatedRpm += (targetRpm - this.animatedRpm) * 0.18;
      this.animatedSpeed += (targetSpeed - this.animatedSpeed) * 0.15;
    }

    if (this.gearDisplay) {
      this.gearDisplay.textContent = state.telemetry.gear || '1';
    }
  }

  _updateShiftLights() {
    const rpm = this.animatedRpm;
    // Umbrales: 5000, 5600, 6200, 6700, 7100
    const thresholds = [4800, 5400, 6000, 6500, 7000];
    this.leds.forEach((led, i) => {
      if (rpm >= thresholds[i]) {
        led.classList.add('active');
      } else {
        led.classList.remove('active');
      }
    });
  }

  _drawTachometer() {
    const ctx = this.tachCtx;
    const w = 600, h = 600, cx = 300, cy = 300, r = 240;
    ctx.clearRect(0, 0, w, h);

    // Fondo del reloj con gradiente radial de profundidad
    const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, r);
    bgGrad.addColorStop(0, '#131b2e');
    bgGrad.addColorStop(0.85, '#090d16');
    bgGrad.addColorStop(1, '#030712');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Aro exterior metálico / neon
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    // Rango angular: de 135° (2.356 rad) a 405° (7.068 rad)
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalAngle = endAngle - startAngle;

    // Escala y marcas
    const maxVal = 8000;
    for (let i = 0; i <= 8; i++) {
      const val = i * 1000;
      const angle = startAngle + (val / maxVal) * totalAngle;
      const isRedline = i >= 6.5;

      const innerR = (i % 1 === 0) ? r - 35 : r - 25;
      const outerR = r - 12;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      ctx.lineWidth = (i % 1 === 0) ? 5 : 2;
      ctx.strokeStyle = isRedline ? '#ef4444' : '#64748b';
      ctx.stroke();

      // Números principales (0..8)
      const numR = r - 60;
      const nx = cx + Math.cos(angle) * numR;
      const ny = cy + Math.sin(angle) * numR;
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = isRedline ? '#ef4444' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i.toString(), nx, ny);
    }

    // Arco de zona roja (6.5k a 8k)
    const redlineStart = startAngle + (6500 / maxVal) * totalAngle;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 16, redlineStart, endAngle);
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.stroke();

    // Arco activo de RPM (Luz de progreso)
    const currentAngle = startAngle + Math.min(1, Math.max(0, this.animatedRpm / maxVal)) * totalAngle;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 16, startAngle, currentAngle);
    ctx.lineWidth = 8;
    const rpmGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    rpmGrad.addColorStop(0, '#06b6d4');
    rpmGrad.addColorStop(0.7, '#38bdf8');
    rpmGrad.addColorStop(1, '#ef4444');
    ctx.strokeStyle = rpmGrad;
    ctx.stroke();

    // Aguja animada
    this._drawNeedle(ctx, cx, cy, currentAngle, r - 45, '#ef4444');

    // Centro / Hub
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Rótulo central de RPM numérico
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(this.animatedRpm).toString(), cx, cy + 120);

    ctx.font = '600 16px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('RPM x1000', cx, cy - 80);
  }

  _drawSpeedometer() {
    const ctx = this.speedCtx;
    const w = 600, h = 600, cx = 300, cy = 300, r = 240;
    ctx.clearRect(0, 0, w, h);

    // Fondo radial
    const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, r);
    bgGrad.addColorStop(0, '#131b2e');
    bgGrad.addColorStop(0.85, '#090d16');
    bgGrad.addColorStop(1, '#030712');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalAngle = endAngle - startAngle;
    const maxVal = 260;

    // Marcas de velocidad cada 20 km/h
    for (let val = 0; val <= maxVal; val += 20) {
      const angle = startAngle + (val / maxVal) * totalAngle;
      const innerR = (val % 40 === 0) ? r - 35 : r - 25;
      const outerR = r - 12;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      ctx.lineWidth = (val % 40 === 0) ? 5 : 2;
      ctx.strokeStyle = (val > 200) ? '#f59e0b' : '#64748b';
      ctx.stroke();

      if (val % 40 === 0) {
        const numR = r - 60;
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toString(), cx + Math.cos(angle) * numR, cy + Math.sin(angle) * numR);
      }
    }

    // Arco activo de velocidad
    const currentAngle = startAngle + Math.min(1, Math.max(0, this.animatedSpeed / maxVal)) * totalAngle;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 16, startAngle, currentAngle);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Aguja
    this._drawNeedle(ctx, cx, cy, currentAngle, r - 45, '#38bdf8');

    // Hub
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Velocidad digital gigante en el centro
    ctx.font = '800 64px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(this.animatedSpeed).toString(), cx, cy + 110);

    ctx.font = '700 18px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('KM/H', cx, cy + 150);

    // Indicador boost sutil arriba
    const boost = stateStore.getState().telemetry.boost || 0;
    ctx.font = '600 16px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`BOOST: ${boost.toFixed(2)} BAR`, cx, cy - 80);
  }

  _drawNeedle(ctx, cx, cy, angle, length, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(length, 0);
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.container.innerHTML = '';
  }
}
