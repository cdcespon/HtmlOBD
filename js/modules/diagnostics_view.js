/**
 * ApexOBD - DiagnosticsView (Agente 4 - Inspiración OBDeleven + Car Scanner)
 * Representación gráfica del chasis en SVG con hotspots de estado,
 * medidor de salud vehicular (0-100%) y gestión de códigos DTC con descripciones y borrado.
 */
import { stateStore } from '../core/state_store.js';

export class DiagnosticsView {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options; // { onScan, onClear, onInjectDemo }
    this._buildLayout();
    this._initElements();
    this._bindEvents();

    this.unsubscribe = stateStore.subscribe(() => this.update());
    this.update();
  }

  _buildLayout() {
    this.container.innerHTML = `
      <div class="diag-container">
        <div class="diag-header">
          <div class="diag-title">
            <span>🛡️ Estado de Salud & Diagnóstico Clínico</span>
          </div>
          <div class="diag-actions">
            <button class="diag-btn primary" id="btn-scan-dtc">🔍 Escanear DTCs</button>
            <button class="diag-btn danger" id="btn-clear-dtc">🗑️ Borrar Códigos</button>
            <button class="diag-btn secondary" id="btn-inject-dtc">⚡ Inyectar Falla Demo</button>
          </div>
        </div>

        <div class="diag-body">
          <!-- Columna Izquierda: Gráfico SVG y Salud Global -->
          <div class="vehicle-visual-card">
            <div class="health-banner">
              <div class="health-score-circle" id="health-circle">100%</div>
              <div class="health-info">
                <h3 id="health-title">Vehículo en Estado Óptimo</h3>
                <p id="health-subtitle">Todos los sistemas responden dentro de los parámetros.</p>
              </div>
            </div>

            <!-- Silueta vectorial del vehículo con nodos interactivos -->
            <div class="car-svg-container">
              <svg viewBox="0 0 200 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <!-- Contorno del vehículo -->
                <path d="M 40,80 Q 40,30 100,20 Q 160,30 160,80 L 165,180 Q 170,260 160,340 Q 155,380 100,380 Q 45,380 40,340 Q 30,260 35,180 Z"
                      fill="#131d2e" stroke="#334155" stroke-width="3" />
                
                <!-- Parabrisas delantero y trasero -->
                <path d="M 50,110 L 150,110 L 140,160 L 60,160 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
                <path d="M 60,280 L 140,280 L 145,315 L 55,315 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" />

                <!-- Ruedas -->
                <rect x="20" y="70" width="16" height="40" rx="4" fill="#0f172a" stroke="#64748b" />
                <rect x="164" y="70" width="16" height="40" rx="4" fill="#0f172a" stroke="#64748b" />
                <rect x="20" y="270" width="16" height="40" rx="4" fill="#0f172a" stroke="#64748b" />
                <rect x="164" y="270" width="16" height="40" rx="4" fill="#0f172a" stroke="#64748b" />

                <!-- Hotspots de subsistemas -->
                <!-- 1. Motor (Frontal central) -->
                <circle id="node-engine" class="car-hotspot healthy" cx="100" cy="75" r="10" />
                <text x="100" y="60" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="sans-serif">Motor</text>

                <!-- 2. Transmisión (Centro) -->
                <circle id="node-transmission" class="car-hotspot healthy" cx="100" cy="180" r="9" />
                <text x="100" y="200" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="sans-serif">Caja / Transmisión</text>

                <!-- 3. Frenos / ABS (Ruedas) -->
                <circle id="node-brakes" class="car-hotspot healthy" cx="45" cy="85" r="7" />
                <text x="45" y="72" text-anchor="middle" font-size="8" fill="#94a3b8" font-family="sans-serif">ABS</text>

                <!-- 4. Escape / Emisiones (Posterior) -->
                <circle id="node-exhaust" class="car-hotspot healthy" cx="100" cy="350" r="8" />
                <text x="100" y="370" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="sans-serif">Emisiones / O2</text>
              </svg>
            </div>
          </div>

          <!-- Columna Derecha: Lista de Códigos de Falla DTC -->
          <div class="dtc-panel" id="dtc-container">
            <!-- Renderizado dinámico -->
          </div>
        </div>
      </div>
    `;
  }

  _initElements() {
    this.healthCircle = this.container.querySelector('#health-circle');
    this.healthTitle = this.container.querySelector('#health-title');
    this.healthSubtitle = this.container.querySelector('#health-subtitle');
    this.dtcContainer = this.container.querySelector('#dtc-container');

    // Hotspots
    this.hotspots = {
      engine: this.container.querySelector('#node-engine'),
      transmission: this.container.querySelector('#node-transmission'),
      brakes: this.container.querySelector('#node-brakes'),
      exhaust: this.container.querySelector('#node-exhaust')
    };

    // Botones
    this.btnScan = this.container.querySelector('#btn-scan-dtc');
    this.btnClear = this.container.querySelector('#btn-clear-dtc');
    this.btnInject = this.container.querySelector('#btn-inject-dtc');
  }

  _bindEvents() {
    this.btnScan.addEventListener('click', () => {
      this.btnScan.textContent = '⏳ Escaneando...';
      if (this.options.onScan) {
        this.options.onScan().finally(() => {
          this.btnScan.textContent = '🔍 Escanear DTCs';
        });
      }
    });

    this.btnClear.addEventListener('click', () => {
      if (confirm('¿Deseas enviar el comando OBD2 Servicio 04 para borrar todos los DTCs y apagar la luz de Check Engine?')) {
        this.btnClear.textContent = '⏳ Borrando...';
        if (this.options.onClear) {
          this.options.onClear().finally(() => {
            this.btnClear.textContent = '🗑️ Borrar Códigos';
          });
        }
      }
    });

    this.btnInject.addEventListener('click', () => {
      if (this.options.onInjectDemo) {
        this.options.onInjectDemo();
      }
    });
  }

  update() {
    const diag = stateStore.getState().diagnostics;
    const dtcs = diag.dtcList || [];
    const score = diag.healthScore;

    // Actualiza Health Score y estilos
    this.healthCircle.textContent = `${score}%`;
    this.healthCircle.className = 'health-score-circle';
    if (score < 60) {
      this.healthCircle.classList.add('critical');
      this.healthTitle.textContent = 'Fallas Críticas Detectadas';
      this.healthSubtitle.textContent = `Se han identificado ${dtcs.length} anomalías que requieren atención.`;
    } else if (score < 90) {
      this.healthCircle.classList.add('warning');
      this.healthTitle.textContent = 'Advertencia de Mantenimiento';
      this.healthSubtitle.textContent = `${dtcs.length} código(s) registrado(s) en la ECU.`;
    } else {
      this.healthTitle.textContent = 'Vehículo en Estado Óptimo';
      this.healthSubtitle.textContent = 'Todos los sistemas responden dentro de los parámetros.';
    }

    // Actualiza Hotspots SVG
    this._updateHotspots(dtcs);

    // Renderiza lista de DTCs
    if (dtcs.length === 0) {
      this.dtcContainer.innerHTML = `
        <div class="dtc-empty-state">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✅</div>
          <h4 style="margin:0; color:#f8fafc; font-size:1.1rem;">Sin códigos de error almacenados</h4>
          <p style="margin:0.5rem 0 0 0; font-size:0.85rem;">La memoria de diagnóstico de la ECU está completamente limpia (MIL apagada).</p>
        </div>
      `;
    } else {
      this.dtcContainer.innerHTML = dtcs.map(d => `
        <div class="dtc-card ${d.severity === 'HIGH' ? 'critical' : (d.severity === 'MEDIUM' ? 'warning' : '')}">
          <div class="dtc-card-header">
            <span class="dtc-code">${d.code}</span>
            <span class="dtc-severity ${d.severity.toLowerCase()}">${d.severity}</span>
          </div>
          <div style="font-size:0.75rem; color:#64748b; font-weight:700; text-transform:uppercase;">${d.system}</div>
          <div class="dtc-desc">${d.description}</div>
          <div class="dtc-tip">💡 <b>Diagnóstico sugerido:</b> ${d.tip}</div>
        </div>
      `).join('');
    }
  }

  _updateHotspots(dtcs) {
    // Reset a saludable
    Object.values(this.hotspots).forEach(node => {
      node.setAttribute('class', 'car-hotspot healthy');
    });

    // Evalúa códigos activos
    dtcs.forEach(d => {
      const code = d.code;
      if (code.startsWith('P03') || code.startsWith('P01')) {
        this.hotspots.engine.setAttribute('class', 'car-hotspot fault');
      }
      if (code.startsWith('P07') || code.startsWith('P05')) {
        this.hotspots.transmission.setAttribute('class', 'car-hotspot fault');
      }
      if (code.startsWith('C0')) {
        this.hotspots.brakes.setAttribute('class', 'car-hotspot fault');
      }
      if (code.startsWith('P04')) {
        this.hotspots.exhaust.setAttribute('class', 'car-hotspot fault');
      }
    });
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
    this.container.innerHTML = '';
  }
}
