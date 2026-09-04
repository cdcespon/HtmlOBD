/**
 * ApexOBD - SerialTransport
 * Implementación de comunicación serie mediante Web Serial API para adaptadores USB / Virtual COM.
 */
import { IOBDTransport } from './transport_interface.js';

export class SerialTransport extends IOBDTransport {
  constructor() {
    super();
    this.name = 'SERIAL';
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.keepReading = false;
    this.readLoopPromise = null;
  }

  /**
   * Solicita al usuario elegir un puerto COM/USB y lo inicializa a 38400 (o 115200) baudios.
   */
  async connect() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API no soportada en este navegador. Utiliza Google Chrome o Microsoft Edge.');
    }

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 38400 });

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(this.port.writable);
      this.writer = textEncoder.writable.getWriter();

      this.keepReading = true;
      this.isConnected = true;
      this.readLoopPromise = this._startReadLoop();
      return true;
    } catch (err) {
      this.isConnected = false;
      throw err;
    }
  }

  async _startReadLoop() {
    const textDecoder = new TextDecoderStream();
    this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.emitData(value);
        }
      }
    } catch (err) {
      console.warn('[SerialTransport] Error en flujo de lectura:', err);
    } finally {
      this.reader.releaseLock();
    }
  }

  async write(cmd) {
    if (!this.isConnected || !this.writer) {
      throw new Error('Puerto serie no conectado');
    }
    const formatted = cmd.endsWith('\r') ? cmd : cmd + '\r';
    await this.writer.write(formatted);
    return formatted;
  }

  async disconnect() {
    this.keepReading = false;
    this.isConnected = false;
    if (this.reader) {
      await this.reader.cancel();
    }
    if (this.writer) {
      await this.writer.close();
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }
}
