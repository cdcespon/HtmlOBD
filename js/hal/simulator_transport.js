/**
 * ApexOBD - SimulatorTransport
 * Emulador de ECU y adaptador ELM327 con motor de física vehicular en tiempo real.
 * Permite probar y validar el 100% de las funciones sin necesidad de hardware físico.
 */
import { IOBDTransport } from './transport_interface.js';
import { DTC_DATABASE } from '../core/obd_constants.js';

export class SimulatorTransport extends IOBDTransport {
  constructor() {
    super();
    this.name = 'SIMULATOR';
    
    // Estado de la física interna simulada del vehículo
    this.physics = {
      throttle: 0,        // 0 a 100%
      rpm: 800,           // Ralentí
      idleRpm: 800,
      maxRpm: 7200,
      speed: 0,           // km/h
      gear: 1,            // 1 a 6
      gearRatios: [0, 3.8, 2.2, 1.5, 1.1, 0.85, 0.7],
      finalDrive: 3.9,
      coolantTemp: 88,    // °C
      oilTemp: 92,        // °C
      intakeTemp: 28,     // °C
      boost: 0,           // bar
      fuelLevel: 68,      // %
      load: 18,           // %
      voltage: 13.8,      // V
      dtcs: ['P0302', 'P0171'], // Códigos de falla inyectados inicialmente para diagnóstico
      mil: true           // Check engine encendido
    };

    this.autoDrive = true; // Simulación de conducción dinámica autónoma
    this.autoDriveTime = 0;
    this.loopTimer = null;
  }

  async connect() {
    this.isConnected = true;
    this._startPhysicsLoop();
    return true;
  }

  async disconnect() {
    this.isConnected = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  /**
   * Modifica el pedal de acelerador simulado externamente (0 a 100)
   */
  setThrottle(percent) {
    this.physics.throttle = Math.max(0, Math.min(100, percent));
    this.autoDrive = false; // Desactiva modo automático al tomar control manual
  }

  enableAutoDrive(enable = true) {
    this.autoDrive = enable;
  }

  /**
   * Inyecta o quita un código DTC en el simulador
   */
  injectDTC(code) {
    if (!this.physics.dtcs.includes(code)) {
      this.physics.dtcs.push(code);
      this.physics.mil = true;
    }
  }

  clearDTCs() {
    this.physics.dtcs = [];
    this.physics.mil = false;
  }

  /**
   * Procesa un comando AT o PID OBD2 simulando la respuesta ELM327
   */
  async write(rawCmd) {
    if (!this.isConnected) throw new Error('Simulador no conectado');

    const cmd = rawCmd.trim().toUpperCase().replace(/\s+/g, '');
    let response = 'OK\r\n>';

    // Comandos AT de ELM327
    if (cmd === 'ATZ') {
      response = 'ELM327 v1.5 HtmlOBD Simulator\r\n>';
    } else if (cmd.startsWith('ATE') || cmd.startsWith('ATL') || cmd.startsWith('ATH') || cmd.startsWith('ATS')) {
      response = 'OK\r\n>';
    } else if (cmd === 'ATSP0') {
      response = 'OK\r\n>';
    } else if (cmd === 'ATDP') {
      response = 'ISO 15765-4 (CAN 11/500)\r\n>';
    } else if (cmd === 'ATRV') {
      response = `${this.physics.voltage.toFixed(1)}V\r\n>`;
    }
    // Servicio 01: PIDs de datos en tiempo real
    else if (cmd.startsWith('01')) {
      const pid = cmd.substring(2, 4);
      response = this._handleService01(pid);
    }
    // Servicio 03: Lectura de códigos de falla DTC
    else if (cmd === '03') {
      response = this._handleService03();
    }
    // Servicio 04: Borrado de códigos de falla DTC y reseteo MIL
    else if (cmd === '04') {
      this.clearDTCs();
      response = '44\r\n>'; // 44 es el echo positivo de servicio 04
    }
    // Servicio 09: VIN del vehículo (8AJBA3CD8P0000001 - Toyota Hilux Argentina Zárate 2023)
    else if (cmd === '0902') {
      response = '49 02 01 38 41 4A 42 \r\n49 02 02 41 33 43 44 \r\n49 02 03 38 50 30 30 \r\n49 02 04 30 30 30 30 31\r\n>';
    } else {
      response = 'NO DATA\r\n>';
    }

    // Emite la respuesta simulada a los suscriptores
    this.emitData(response);
    return response;
  }

  _handleService01(pid) {
    switch (pid) {
      case '00': // PIDs soportados 01-20
        return '41 00 BE 3E B8 11\r\n>';
      case '04': { // Carga calculada
        const hex = Math.round((this.physics.load * 255) / 100).toString(16).padStart(2, '0').toUpperCase();
        return `41 04 ${hex}\r\n>`;
      }
      case '05': { // Refrigerante (val = A - 40)
        const val = Math.round(this.physics.coolantTemp + 40);
        const hex = Math.min(255, Math.max(0, val)).toString(16).padStart(2, '0').toUpperCase();
        return `41 05 ${hex}\r\n>`;
      }
      case '0B': { // MAP (Presión de admisión)
        const mapKpa = Math.round(101 + (this.physics.boost * 100));
        const hex = Math.min(255, Math.max(0, mapKpa)).toString(16).padStart(2, '0').toUpperCase();
        return `41 0B ${hex}\r\n>`;
      }
      case '0C': { // RPM (val = ((A*256) + B) / 4)
        const total = Math.round(this.physics.rpm * 4);
        const a = Math.floor(total / 256).toString(16).padStart(2, '0').toUpperCase();
        const b = (total % 256).toString(16).padStart(2, '0').toUpperCase();
        return `41 0C ${a} ${b}\r\n>`;
      }
      case '0D': { // Velocidad
        const hex = Math.round(Math.min(255, Math.max(0, this.physics.speed))).toString(16).padStart(2, '0').toUpperCase();
        return `41 0D ${hex}\r\n>`;
      }
      case '0E': { // Avance encendido
        const val = Math.round((14 + 64) * 2);
        return `41 0E ${val.toString(16).padStart(2, '0').toUpperCase()}\r\n>`;
      }
      case '0F': { // Temp aire admisión (IAT)
        const val = Math.round(this.physics.intakeTemp + 40);
        return `41 0F ${val.toString(16).padStart(2, '0').toUpperCase()}\r\n>`;
      }
      case '10': { // Flujo de aire MAF
        const maf = Math.round((this.physics.rpm / 80) * 100);
        const a = Math.floor(maf / 256).toString(16).padStart(2, '0').toUpperCase();
        const b = (maf % 256).toString(16).padStart(2, '0').toUpperCase();
        return `41 10 ${a} ${b}\r\n>`;
      }
      case '11': { // Posición acelerador TPS
        const hex = Math.round((this.physics.throttle * 255) / 100).toString(16).padStart(2, '0').toUpperCase();
        return `41 11 ${hex}\r\n>`;
      }
      case '2F': { // Nivel combustible
        const hex = Math.round((this.physics.fuelLevel * 255) / 100).toString(16).padStart(2, '0').toUpperCase();
        return `41 2F ${hex}\r\n>`;
      }
      case '5C': { // Temp de aceite motor
        const val = Math.round(this.physics.oilTemp + 40);
        return `41 5C ${val.toString(16).padStart(2, '0').toUpperCase()}\r\n>`;
      }
      default:
        return 'NO DATA\r\n>';
    }
  }

  _handleService03() {
    if (this.physics.dtcs.length === 0) {
      return '43 00\r\n>'; // Cero DTCs
    }

    // Codifica hasta 3 DTCs en formato OBD2 estándar
    // Ejemplo P0302 -> 03 02 -> bytes: 03 02
    // Ejemplo P0171 -> 01 71 -> bytes: 01 71
    let frame = `43 0${this.physics.dtcs.length}`;
    for (const code of this.physics.dtcs) {
      const numPart = code.substring(1); // '0302'
      const byte1 = numPart.substring(0, 2);
      const byte2 = numPart.substring(2, 4);
      frame += ` ${byte1} ${byte2}`;
    }
    return `${frame}\r\n>`;
  }

  /**
   * Bucle de física vehicular realista a 50Hz (20ms)
   */
  _startPhysicsLoop() {
    if (this.loopTimer) clearInterval(this.loopTimer);

    this.loopTimer = setInterval(() => {
      if (!this.isConnected) return;

      // Ciclo de conducción autónoma si está activo
      if (this.autoDrive) {
        this.autoDriveTime += 0.05;
        // Simula aceleraciones y cambios de marcha suaves
        const cycle = Math.sin(this.autoDriveTime * 0.5);
        if (cycle > 0) {
          this.physics.throttle = Math.min(85, Math.max(15, (cycle * 90)));
        } else {
          this.physics.throttle = 0;
        }
      }

      // Dinámica de RPM y marcha
      const targetRpm = this.physics.idleRpm + (this.physics.throttle / 100) * (this.physics.maxRpm - this.physics.idleRpm);
      
      // Aceleración con inercia
      if (this.physics.rpm < targetRpm) {
        this.physics.rpm += (targetRpm - this.physics.rpm) * 0.15;
      } else {
        this.physics.rpm -= (this.physics.rpm - targetRpm) * 0.08;
      }

      // Simulación de transmisión y cambios de marcha
      if (this.physics.rpm > 5800 && this.physics.gear < 6) {
        this.physics.gear++;
        this.physics.rpm -= 1800; // Caída de vueltas en cambio de marcha
      } else if (this.physics.rpm < 1600 && this.physics.gear > 1 && this.physics.speed < 40) {
        this.physics.gear--;
        this.physics.rpm += 1200;
      }

      // Velocidad basada en RPM y relación de marcha
      const ratio = this.physics.gearRatios[this.physics.gear];
      const speedKmh = (this.physics.rpm / (ratio * this.physics.finalDrive)) * 0.18;
      this.physics.speed = Math.max(0, Math.min(260, speedKmh));

      // Presión de turbo (Boost)
      if (this.physics.throttle > 35 && this.physics.rpm > 2200) {
        const targetBoost = ((this.physics.throttle - 35) / 65) * 1.4; // Hasta 1.4 bar
        this.physics.boost += (targetBoost - this.physics.boost) * 0.12;
      } else {
        this.physics.boost += (0 - this.physics.boost) * 0.15;
      }

      // Carga calculada
      this.physics.load = Math.round(15 + (this.physics.throttle * 0.75) + (this.physics.boost * 15));

      // Variación sutil de temperatura de refrigerante
      this.physics.coolantTemp = 88 + Math.sin(this.autoDriveTime * 0.1) * 3;
      this.physics.oilTemp = 93 + Math.sin(this.autoDriveTime * 0.08) * 4;
      this.physics.voltage = 13.8 + (Math.random() * 0.2 - 0.1);

    }, 20);
  }
}
