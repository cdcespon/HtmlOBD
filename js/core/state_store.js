/**
 * ApexOBD - StateStore
 * Almacén reactivo de estado centralizado.
 * Cumple con el Contrato Agéntico de ApexOBD.
 */
import { eventBus } from './event_bus.js';

export class StateStore {
  constructor() {
    this.state = {
      connection: {
        status: 'DISCONNECTED', // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
        transportType: 'SIMULATOR', // 'SIMULATOR' | 'SERIAL' | 'BLE' | 'WEBSOCKET'
        protocol: 'AUTO',
        voltage: 12.6,
        fps: 60,
        deviceInfo: 'Desconectado'
      },
      telemetry: {
        rpm: 0,
        speed: 0,
        coolantTemp: 20,
        intakeTemp: 22,
        oilTemp: 25,
        throttle: 0,
        boost: 0, // bar
        map: 101, // kPa
        maf: 0,   // g/s
        fuelLevel: 75,
        load: 0,
        timingAdvance: 10,
        gear: 'P' // P, R, N, D, 1, 2, 3, 4, 5, 6
      },
      diagnostics: {
        healthScore: 100,
        milActive: false, // Check Engine Light
        dtcList: [],
        lastScanTime: null,
        freezeFrame: null
      },
      performance: {
        dragTimer: {
          status: 'IDLE', // 'IDLE' | 'READY' | 'RUNNING' | 'COMPLETED'
          time0to100: null,
          timeQuarterMile: null,
          currentRunTime: 0,
          topSpeed: 0
        },
        telemetryHistory: [] // buffer para gráficas continuas
      }
    };

    this.subscribers = new Set();
  }

  /**
   * Obtiene una copia o lectura del estado completo
   */
  getState() {
    return this.state;
  }

  /**
   * Actualiza el estado de conexión
   */
  updateConnection(partial) {
    this.state.connection = { ...this.state.connection, ...partial };
    eventBus.emit('connection:change', this.state.connection);
    this._notify();
  }

  /**
   * Actualiza uno o varios valores de telemetría y notifica al bus
   */
  updateTelemetry(partial) {
    let changed = false;
    for (const key in partial) {
      if (this.state.telemetry[key] !== partial[key]) {
        this.state.telemetry[key] = partial[key];
        changed = true;
        eventBus.emit('telemetry:update', {
          key,
          value: partial[key],
          timestamp: performance.now()
        });
      }
    }
    if (changed) {
      this._notify();
    }
  }

  /**
   * Actualiza el diagnóstico (DTCs, Score, MIL)
   */
  updateDiagnostics(partial) {
    this.state.diagnostics = { ...this.state.diagnostics, ...partial };
    eventBus.emit('diagnostics:scan_complete', this.state.diagnostics);
    this._notify();
  }

  /**
   * Actualiza las métricas de rendimiento
   */
  updatePerformance(partial) {
    this.state.performance = { ...this.state.performance, ...partial };
    this._notify();
  }

  /**
   * Suscribe una función para reaccionar a cualquier cambio de estado
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _notify() {
    this.subscribers.forEach(cb => {
      try {
        cb(this.state);
      } catch (err) {
        console.error('[StateStore] Error en suscriptor:', err);
      }
    });
  }

  /**
   * Restablece el estado a valores iniciales
   */
  reset() {
    this.state.telemetry.rpm = 0;
    this.state.telemetry.speed = 0;
    this.state.telemetry.throttle = 0;
    this.state.telemetry.boost = 0;
    this.state.telemetry.gear = 'P';
    this.state.performance.dragTimer.status = 'IDLE';
    this.state.performance.dragTimer.time0to100 = null;
    this.state.performance.dragTimer.timeQuarterMile = null;
    this._notify();
  }
}

export const stateStore = new StateStore();
