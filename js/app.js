/**
 * ApexOBD - Application Bootstrap & Orchestrator
 * Integra los módulos agénticos, administra la capa de transporte y la navegación SPA.
 */
import { eventBus } from './core/event_bus.js';
import { stateStore } from './core/state_store.js';
import { ProtocolEngine } from './core/protocol_engine.js';
import { SimulatorTransport } from './hal/simulator_transport.js';
import { SerialTransport } from './hal/serial_transport.js';
import { BLETransport } from './hal/ble_transport.js';

import { CockpitView } from './modules/cockpit_view.js';
import { TelemetryView } from './modules/telemetry_view.js';
import { DiagnosticsView } from './modules/diagnostics_view.js';
import { PerformanceView } from './modules/performance_view.js';

class ApexOBDApp {
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

  _listenStore() {
    stateStore.subscribe((state) => {
      // Estado de conexión
      const conn = state.connection;
      this.statusBadge.className = `status-pill ${conn.status.toLowerCase()}`;
      this.statusText.textContent = conn.status;
      this.btnToggleConnect.textContent = conn.status === 'CONNECTED' ? 'Desconectar' : 'Conectar';
      
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
  window.app = new ApexOBDApp();
});
