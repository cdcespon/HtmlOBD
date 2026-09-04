/**
 * HtmlOBD - Application Bootstrap & Orchestrator
 * Integra los módulos agénticos, administra la capa de transporte y la navegación SPA.
 */
import { eventBus } from './core/event_bus.js';
import { stateStore } from './core/state_store.js';
import { ProtocolEngine } from './core/protocol_engine.js';
import { ARGENTINA_VEHICLES, decodeVin } from './core/vehicle_catalog.js';
import { SimulatorTransport } from './hal/simulator_transport.js';
import { SerialTransport } from './hal/serial_transport.js';
import { BLETransport } from './hal/ble_transport.js';

import { CockpitView } from './modules/cockpit_view.js';
import { TelemetryView } from './modules/telemetry_view.js';
import { DiagnosticsView } from './modules/diagnostics_view.js';
import { PerformanceView } from './modules/performance_view.js';

class HtmlOBDApp {
  constructor() {
    this.viewport = document.getElementById('viewport');
    this.currentViewInstance = null;
    this.currentViewName = 'cockpit';

    // Instanciación de transportes
    this.simulator = new SimulatorTransport();
    this.serial = new SerialTransport();
    this.ble = new BLETransport();
    
    // Transporte activo inicial: Simulador
    this.activeTransport = this.simulator;
    this.engine = new ProtocolEngine(this.activeTransport);

    this._initDomReferences();
    this._bindNavigation();
    this._bindThemeSelector();
    this._bindHeaderEvents();
    this._initVehicleModal();
    this._listenStore();

    // Inicia con la vista Cockpit y auto-conecta el simulador
    this.switchView('cockpit');
    this._autoConnectSimulator();
  }

  _initDomReferences() {
    this.statusBadge = document.getElementById('status-badge');
    this.statusText = document.getElementById('status-text');
    this.headerVoltage = document.getElementById('header-voltage');
    this.headerProtocol = document.getElementById('header-protocol');
    this.headerMil = document.getElementById('header-mil');
    this.transportSelect = document.getElementById('transport-select');
    this.btnToggleConnect = document.getElementById('btn-toggle-connect');
    this.navItems = document.querySelectorAll('.nav-item');

    // Referencias de selector de vehículo
    this.btnVehicleModal = document.getElementById('btn-vehicle-modal');
    this.activeVehicleName = document.getElementById('active-vehicle-name');
    this.activeVehicleOrigin = document.getElementById('active-vehicle-origin');
    this.vehicleModal = document.getElementById('vehicle-modal');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.btnCancelModal = document.getElementById('btn-cancel-modal');
    this.btnDetectVin = document.getElementById('btn-detect-vin');
    this.btnApplyVehicle = document.getElementById('btn-apply-vehicle');
    this.vinReadout = document.getElementById('vin-readout');
    this.vehicleDropdown = document.getElementById('vehicle-select-preset');
    this.vehicleSpecsContainer = document.getElementById('vehicle-specs-container');
  }

  _bindNavigation() {
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewName = item.getAttribute('data-view');
        this.switchView(viewName);
      });
    });
  }

  _bindThemeSelector() {
    document.querySelectorAll('.theme-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const theme = dot.getAttribute('data-theme');
        if (theme === 'default') {
          document.documentElement.removeAttribute('data-theme');
        } else {
          document.documentElement.setAttribute('data-theme', theme);
        }
      });
    });
  }

  _bindHeaderEvents() {
    this.btnToggleConnect.addEventListener('click', async () => {
      if (this.activeTransport.isConnected) {
        this.engine.stopPolling();
        await this.activeTransport.disconnect();
        stateStore.updateConnection({ status: 'DISCONNECTED', deviceInfo: 'Desconectado por el usuario' });
      } else {
        await this._connectSelectedTransport();
      }
    });

    this.transportSelect.addEventListener('change', async () => {
      if (this.activeTransport.isConnected) {
        this.engine.stopPolling();
        await this.activeTransport.disconnect();
      }

      const selected = this.transportSelect.value;
      if (selected === 'SIMULATOR') {
        this.activeTransport = this.simulator;
      } else if (selected === 'SERIAL') {
        this.activeTransport = this.serial;
      } else if (selected === 'BLE') {
        this.activeTransport = this.ble;
      }
      this.engine.setTransport(this.activeTransport);
      await this._connectSelectedTransport();
    });
  }

  async _connectSelectedTransport() {
    try {
      stateStore.updateConnection({ status: 'CONNECTING' });
      await this.activeTransport.connect();
      await this.engine.initializeDevice();
      
      // Si la vista actual es el Cockpit, dispara el barrido de agujas
      if (this.currentViewInstance && typeof this.currentViewInstance.triggerSweep === 'function') {
        this.currentViewInstance.triggerSweep();
      }
    } catch (err) {
      console.warn('Error al conectar transporte:', err);
      stateStore.updateConnection({ status: 'ERROR', deviceInfo: err.message });
      alert(`Error al conectar: ${err.message}`);
    }
  }

  async _autoConnectSimulator() {
    try {
      await this.activeTransport.connect();
      await this.engine.initializeDevice();
    } catch (err) {
      console.error('Error auto-conectando simulador:', err);
    }
  }

  _initVehicleModal() {
    // Rellenar selector de vehículos de Argentina
    this.vehicleDropdown.innerHTML = ARGENTINA_VEHICLES.map(v => `
      <option value="${v.id}">${v.brand} ${v.model} (${v.year}) - ${v.engine}</option>
    `).join('');

    const renderSpecs = (vehicle) => {
      this.vehicleSpecsContainer.innerHTML = `
        <div class="spec-item">
          <div class="spec-label">Motorización</div>
          <div class="spec-val">${vehicle.engine}</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Potencia / Torque</div>
          <div class="spec-val">${vehicle.powerHp} CV / ${vehicle.torqueNm} Nm</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Peso en Vacío</div>
          <div class="spec-val">${vehicle.weightKg} kg</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Zona Roja (Corte)</div>
          <div class="spec-val" style="color:#ef4444;">${vehicle.redlineRpm} RPM</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Prefijo Chasis (WMI)</div>
          <div class="spec-val" style="color:#38bdf8;">${vehicle.vinPrefix} (Argentina)</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Tipo Combustible</div>
          <div class="spec-val">${vehicle.fuelType}</div>
        </div>
        <div class="spec-item" style="grid-column: span 2;">
          <div class="spec-label">Origen & Planta</div>
          <div class="spec-val" style="font-size:0.85rem; color:#94a3b8;">${vehicle.description}</div>
        </div>
      `;
    };

    // Renderiza el primer vehículo inicialmente
    renderSpecs(ARGENTINA_VEHICLES[0]);

    this.vehicleDropdown.addEventListener('change', () => {
      const selected = ARGENTINA_VEHICLES.find(v => v.id === this.vehicleDropdown.value);
      if (selected) renderSpecs(selected);
    });

    this.btnVehicleModal.addEventListener('click', () => {
      this.vehicleModal.style.display = 'flex';
    });

    const closeModal = () => {
      this.vehicleModal.style.display = 'none';
    };
    this.btnCloseModal.addEventListener('click', closeModal);
    this.btnCancelModal.addEventListener('click', closeModal);

    this.btnApplyVehicle.addEventListener('click', () => {
      const selected = ARGENTINA_VEHICLES.find(v => v.id === this.vehicleDropdown.value);
      if (selected) {
        stateStore.updateVehicleProfile(selected);
        closeModal();
      }
    });

    // Detección por VIN (Servicio 09)
    this.btnDetectVin.addEventListener('click', async () => {
      this.btnDetectVin.textContent = 'Leyendo VIN...';
      this.vinReadout.textContent = 'Consultando Servicio 09 PID 02 a la ECU...';
      try {
        const decoded = await this.engine.readVin();
        if (decoded && decoded.valid) {
          this.vinReadout.innerHTML = `
            <strong>VIN: ${decoded.vin}</strong><br>
            <span>Fabricante: ${decoded.brand} (${decoded.country} - Planta: ${decoded.assemblyPlant})</span><br>
            <span>Año Modelo: ${decoded.modelYear} | Serie: ${decoded.serialNumber}</span>
          `;
          if (decoded.matchedProfile) {
            this.vehicleDropdown.value = decoded.matchedProfile.id;
            renderSpecs(decoded.matchedProfile);
          }
        } else {
          this.vinReadout.textContent = `Error o formato no reconocido: ${decoded?.error || 'Sin respuesta'}`;
        }
      } catch (err) {
        this.vinReadout.textContent = `Fallo de comunicación OBD2: ${err.message}`;
      } finally {
        this.btnDetectVin.textContent = 'Leer VIN (0902)';
      }
    });
  }

  _listenStore() {
    stateStore.subscribe((state) => {
      // Estado de conexión
      const conn = state.connection;
      this.statusBadge.className = `status-pill ${conn.status.toLowerCase()}`;
      this.statusText.textContent = conn.status;
      this.btnToggleConnect.textContent = conn.status === 'CONNECTED' ? 'Desconectar' : 'Conectar';
      
      // Vehículo Activo en Header
      const veh = state.vehicleProfile;
      if (veh) {
        this.activeVehicleName.textContent = `${veh.brand} ${veh.model}`;
        this.activeVehicleOrigin.textContent = veh.fuelType.toUpperCase();
      }

      // Voltaje y protocolo
      this.headerVoltage.textContent = `${conn.voltage.toFixed(1)}V`;
      this.headerProtocol.textContent = conn.protocol.split(' ')[0] || 'CAN';

      // Check Engine MIL
      const mil = state.diagnostics.milActive;
      this.headerMil.textContent = mil ? 'ON' : 'OFF';
      this.headerMil.style.color = mil ? '#ef4444' : '#10b981';
    });
  }

  switchView(viewName) {
    if (this.currentViewInstance) {
      this.currentViewInstance.destroy();
      this.currentViewInstance = null;
    }

    this.currentViewName = viewName;

    // Actualiza estilo activo en sidebar
    this.navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.viewport.innerHTML = '';

    // Instancia el componente según la vista seleccionada
    switch (viewName) {
      case 'cockpit':
        this.currentViewInstance = new CockpitView(this.viewport, {
          onThrottleChange: (percent) => {
            if (this.activeTransport === this.simulator) {
              this.simulator.setThrottle(percent);
            }
          }
        });
        break;

      case 'telemetry':
        this.currentViewInstance = new TelemetryView(this.viewport);
        break;

      case 'diagnostics':
        this.currentViewInstance = new DiagnosticsView(this.viewport, {
          onScan: () => this.engine.scanDTCs(),
          onClear: () => this.engine.clearDTCs(),
          onInjectDemo: () => {
            if (this.activeTransport === this.simulator) {
              this.simulator.injectDTC('P0300');
              this.engine.scanDTCs();
            }
          }
        });
        break;

      case 'performance':
        this.currentViewInstance = new PerformanceView(this.viewport, {
          onSendCommand: (cmd) => this.engine.sendCommand(cmd).catch(err => {
            eventBus.emit('terminal:packet', {
              direction: 'RX',
              raw: `ERROR: ${err.message}`,
              timestamp: Date.now()
            });
          })
        });
        break;

      case 'arbiter':
        // Carga la suite de pruebas automatizadas del Juez Decisor en un iframe aislado
        this.viewport.innerHTML = `
          <iframe src="tests/arbiter_test_suite.html" style="width:100%; height:100%; border:none; background:#0b0f19;"></iframe>
        `;
        this.currentViewInstance = {
          destroy: () => { this.viewport.innerHTML = ''; }
        };
        break;

      default:
        this.viewport.innerHTML = `<div style="padding:2rem;">Vista no encontrada: ${viewName}</div>`;
    }
  }
}

// Inicialización de la aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.app = new HtmlOBDApp();
});
