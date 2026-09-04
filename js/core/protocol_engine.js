/**
 * HtmlOBD - ProtocolEngine
 * Motor de protocolo ELM327 y SAE J1979.
 * Orquesta la cola de comandos, parsing de respuestas hex, polling de PIDs y control de DTCs.
 */
import { AT_COMMANDS, OBD_PIDS, DTC_DATABASE } from './obd_constants.js';
import { eventBus } from './event_bus.js';
import { stateStore } from './state_store.js';
import { decodeVin } from './vehicle_catalog.js';

export class ProtocolEngine {
  constructor(transport) {
    this.transport = transport;
    this.buffer = '';
    this.currentResolver = null;
    this.commandTimeoutTimer = null;
    this.isPolling = false;
    this.pollTimer = null;

    // Vincula la recepción de datos desde el transporte
    if (this.transport) {
      this.transport.onData(data => this._onRawDataReceived(data));
    }
  }

  setTransport(newTransport) {
    if (this.transport) {
      this.transport.disconnect();
    }
    this.transport = newTransport;
    this.buffer = '';
    this.transport.onData(data => this._onRawDataReceived(data));
  }

  /**
   * Procesa fragmentos de datos serie entrantes y detecta el prompt '>' de ELM327
   */
  _onRawDataReceived(chunk) {
    this.buffer += chunk;

    // Emite paquete de terminal crudo RX
    eventBus.emit('terminal:packet', {
      direction: 'RX',
      raw: chunk,
      timestamp: Date.now()
    });

    if (this.buffer.includes('>')) {
      const fullResponse = this.buffer.trim();
      this.buffer = '';

      if (this.commandTimeoutTimer) {
        clearTimeout(this.commandTimeoutTimer);
        this.commandTimeoutTimer = null;
      }

      if (this.currentResolver) {
        const resolve = this.currentResolver;
        this.currentResolver = null;
        resolve(fullResponse);
      }
    }
  }

  /**
   * Envía un comando individual esperando la respuesta hasta el carácter prompt '>'
   */
  sendCommand(cmd, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
      if (!this.transport || !this.transport.isConnected) {
        return reject(new Error('Transporte no conectado'));
      }

      // Emite paquete de terminal crudo TX
      eventBus.emit('terminal:packet', {
        direction: 'TX',
        raw: cmd,
        timestamp: Date.now()
      });

      this.currentResolver = resolve;
      this.commandTimeoutTimer = setTimeout(() => {
        this.currentResolver = null;
        reject(new Error(`Timeout esperando respuesta para comando: ${cmd}`));
      }, timeoutMs);

      this.transport.write(cmd).catch(err => {
        if (this.commandTimeoutTimer) clearTimeout(this.commandTimeoutTimer);
        this.currentResolver = null;
        reject(err);
      });
    });
  }

  /**
   * Secuencia de inicialización AT estándar
   */
  async initializeDevice() {
    stateStore.updateConnection({ status: 'CONNECTING', deviceInfo: 'Inicializando adaptador...' });

    try {
      await this.sendCommand(AT_COMMANDS.RESET, 3000);
      await this.sendCommand(AT_COMMANDS.ECHO_OFF);
      await this.sendCommand(AT_COMMANDS.LINEFEEDS_OFF);
      await this.sendCommand(AT_COMMANDS.AUTO_PROTOCOL);
      
      let voltage = 12.6;
      try {
        const voltResp = await this.sendCommand(AT_COMMANDS.READ_VOLTAGE, 1500);
        const match = voltResp.match(/([0-9]+\.[0-9]+)V?/i);
        if (match) voltage = parseFloat(match[1]);
      } catch (_) {}

      let protocol = 'ISO 15765-4 (CAN)';
      try {
        const protoResp = await this.sendCommand(AT_COMMANDS.DESCRIBE_PROTOCOL, 1500);
        protocol = protoResp.replace('>', '').trim() || protocol;
      } catch (_) {}

      stateStore.updateConnection({
        status: 'CONNECTED',
        voltage,
        protocol,
        deviceInfo: `${this.transport.name} conectado`
      });

      // Inicia polling cíclico de telemetría
      this.startPolling();
      return true;
    } catch (err) {
      console.error('[ProtocolEngine] Error en inicialización:', err);
      stateStore.updateConnection({
        status: 'ERROR',
        deviceInfo: `Error de conexión: ${err.message}`
      });
      throw err;
    }
  }

  /**
   * Bucle de consultas continuas a la ECU con prioridad
   */
  startPolling(intervalMs = 40) {
    if (this.isPolling) return;
    this.isPolling = true;

    let cycleCount = 0;

    const pollStep = async () => {
      if (!this.isPolling || !this.transport || !this.transport.isConnected) {
        this.isPolling = false;
        return;
      }

      try {
        // PIDs de alta frecuencia (cada ciclo): RPM (0C), Velocidad (0D), Acelerador (11), MAP (0B)
        await this._queryPid(OBD_PIDS.ENGINE_RPM);
        await this._queryPid(OBD_PIDS.VEHICLE_SPEED);
        await this._queryPid(OBD_PIDS.THROTTLE_POS);
        await this._queryPid(OBD_PIDS.INTAKE_PRESSURE);

        // PIDs de baja frecuencia (cada 15 ciclos): Refrigerante, Aceite, MAF, Carga
        cycleCount++;
        if (cycleCount % 10 === 0) {
          await this._queryPid(OBD_PIDS.COOLANT_TEMP);
          await this._queryPid(OBD_PIDS.ENGINE_LOAD);
        }
        if (cycleCount % 25 === 0) {
          await this._queryPid(OBD_PIDS.OIL_TEMP);
          await this._queryPid(OBD_PIDS.INTAKE_AIR_TEMP);
          await this._queryPid(OBD_PIDS.FUEL_LEVEL);
        }
      } catch (err) {
        // Errores transitorios no detienen el polling
      }

      if (this.isPolling) {
        this.pollTimer = setTimeout(pollStep, intervalMs);
      }
    };

    pollStep();
  }

  stopPolling() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Consulta un PID y decodifica su valor hacia el StateStore
   */
  async _queryPid(pidObj) {
    const cmd = `01${pidObj.pid}`;
    const raw = await this.sendCommand(cmd, 800);
    const bytes = this._extractDataBytes(raw, '41', pidObj.pid);

    if (bytes && bytes.length > 0) {
      const value = pidObj.decode(bytes);
      this._updateTelemetryProperty(pidObj.pid, value);
    }
  }

  /**
   * Mapea el PID numérico a la propiedad del store
   */
  _updateTelemetryProperty(pid, value) {
    const map = {};
    switch (pid) {
      case '0C':
        map.rpm = Math.round(value);
        break;
      case '0D':
        map.speed = Math.round(value);
        break;
      case '05':
        map.coolantTemp = Math.round(value);
        break;
      case '0F':
        map.intakeTemp = Math.round(value);
        break;
      case '5C':
        map.oilTemp = Math.round(value);
        break;
      case '11':
        map.throttle = Math.round(value);
        break;
      case '0B': { // MAP -> Boost estimado en bar (MAP en kPa - 101.3 kPa / 100)
        map.map = value;
        const boostBar = Math.max(0, (value - 101.3) / 100);
        map.boost = parseFloat(boostBar.toFixed(2));
        break;
      }
      case '04':
        map.load = Math.round(value);
        break;
      case '2F':
        map.fuelLevel = Math.round(value);
        break;
    }
    stateStore.updateTelemetry(map);
  }

  /**
   * Escaneo completo de Códigos de Falla DTC (Servicio 03)
   */
  async scanDTCs() {
    const wasPolling = this.isPolling;
    this.stopPolling();

    try {
      const resp = await this.sendCommand('03', 2500);
      const dtcs = this._parseDTCResponse(resp);
      
      const healthScore = dtcs.length === 0 ? 100 : Math.max(10, 100 - (dtcs.length * 25));
      const milActive = dtcs.length > 0;

      stateStore.updateDiagnostics({
        dtcList: dtcs,
        healthScore,
        milActive,
        lastScanTime: new Date().toLocaleTimeString()
      });

      return dtcs;
    } finally {
      if (wasPolling) {
        this.startPolling();
      }
    }
  }

  /**
   * Borrado de códigos de falla (Servicio 04)
   */
  async clearDTCs() {
    const wasPolling = this.isPolling;
    this.stopPolling();

    try {
      await this.sendCommand('04', 3000);
      stateStore.updateDiagnostics({
        dtcList: [],
        healthScore: 100,
        milActive: false,
        lastScanTime: new Date().toLocaleTimeString()
      });
      eventBus.emit('diagnostics:clear_success', { timestamp: Date.now() });
      return true;
    } finally {
      if (wasPolling) {
        this.startPolling();
      }
    }
  }

  /**
   * Consulta y decodifica el número VIN del vehículo (Servicio 09 PID 02)
   */
  async readVin() {
    const wasPolling = this.isPolling;
    this.stopPolling();

    try {
      const raw = await this.sendCommand('0902', 3000);
      const clean = raw.replace(/>/g, '').trim();
      const lines = clean.split(/[\r\n]+/);
      let hexChars = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        // Formato típico '49 02 01 XX XX XX XX'
        if (parts[0] === '49' && parts[1] === '02') {
          // Extrae los bytes de datos después del índice de trama (parts[2])
          const dataBytes = parts.slice(3);
          hexChars.push(...dataBytes);
        }
      }

      // Convierte los bytes hex a caracteres ASCII
      let vinStr = '';
      for (const h of hexChars) {
        const charCode = parseInt(h, 16);
        if (!isNaN(charCode) && charCode >= 32 && charCode <= 126) {
          vinStr += String.fromCharCode(charCode);
        }
      }

      // Si no se obtuvo con formato multiframe estándar, buscar secuencias de 17 caracteres
      if (vinStr.length < 17) {
        const matches = raw.match(/[A-HJ-NPR-Z0-9]{17}/i);
        if (matches) vinStr = matches[0].toUpperCase();
      }

      const decoded = decodeVin(vinStr);
      if (decoded && decoded.valid && decoded.matchedProfile) {
        stateStore.updateVehicleProfile(decoded.matchedProfile);
      }
      return decoded;
    } finally {
      if (wasPolling) {
        this.startPolling();
      }
    }
  }

  /**
   * Parsea una respuesta del Servicio 03 a objetos DTC
   */
  _parseDTCResponse(raw) {
    const clean = raw.replace(/>/g, '').trim();
    const parts = clean.split(/\s+/);
    const dtcs = [];

    // Busca coincidencia de tramas tipo '43 XX B1 B2 ...'
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '43') {
        const count = parseInt(parts[i + 1] || '0', 16);
        let cursor = i + 2;
        for (let c = 0; c < count && cursor + 1 < parts.length; c++) {
          const b1 = parts[cursor];
          const b2 = parts[cursor + 1];
          const code = this._decodeDtcBytes(b1, b2);
          if (code && code !== 'P0000') {
            const meta = DTC_DATABASE[code] || {
              system: 'Diagnóstico Genérico',
              description: 'Código de falla del fabricante registrado en ECU',
              severity: 'MEDIUM',
              tip: 'Consultar manual técnico para este código de avería.'
            };
            dtcs.push({
              code,
              ...meta
            });
          }
          cursor += 2;
        }
        break;
      }
    }
    return dtcs;
  }

  _decodeDtcBytes(b1Str, b2Str) {
    const b1 = parseInt(b1Str, 16);
    const b2 = parseInt(b2Str, 16);
    if (isNaN(b1) || isNaN(b2)) return null;

    // Primeros 2 bits determinan P, C, B, U
    const typeIndex = (b1 & 0xC0) >> 6;
    const prefix = ['P', 'C', 'B', 'U'][typeIndex];
    const digit1 = (b1 & 0x30) >> 4;
    const digit2 = (b1 & 0x0F);
    const digit3 = (b2 & 0xF0) >> 4;
    const digit4 = (b2 & 0x0F);

    return `${prefix}${digit1}${digit2}${digit3.toString(16)}${digit4.toString(16)}`.toUpperCase();
  }

  _extractDataBytes(raw, expectedService, expectedPid) {
    const clean = raw.replace(/>/g, '').trim();
    const parts = clean.split(/\s+/);
    const idx = parts.findIndex((p, i) => p === expectedService && parts[i + 1] === expectedPid);
    if (idx !== -1) {
      return parts.slice(idx + 2).map(hex => parseInt(hex, 16)).filter(n => !isNaN(n));
    }
    return null;
  }
}
