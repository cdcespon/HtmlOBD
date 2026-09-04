/**
 * ApexOBD - BLETransport
 * Implementación de comunicación inalámbrica mediante Web Bluetooth API para adaptadores BLE OBD2.
 */
import { IOBDTransport } from './transport_interface.js';

// Servicios GATT estándar usados por adaptadores OBD2 BLE (Nordic UART, Microchip, etc.)
const BLE_SERVICES = [
  '0000fff0-0000-1000-8000-00805f9b34fb', // Vgate / Veepeak común
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '0000ffe0-0000-1000-8000-00805f9b34fb'  // CC2541 / HM-10 genérico
];

export class BLETransport extends IOBDTransport {
  constructor() {
    super();
    this.name = 'BLE';
    this.device = null;
    this.server = null;
    this.rxChar = null; // Lectura / Notificaciones
    this.txChar = null; // Escritura
  }

  async connect() {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth API no soportada en este navegador. Utiliza Google Chrome o Microsoft Edge.');
    }

    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SERVICES
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
      });

      this.server = await this.device.gatt.connect();

      // Busca el primer servicio serie disponible
      let service = null;
      for (const sUuid of BLE_SERVICES) {
        try {
          service = await this.server.getPrimaryService(sUuid);
          if (service) break;
        } catch (_) {}
      }

      if (!service) {
        throw new Error('No se encontró el servicio UART/Serie compatible en el dongle BLE');
      }

      const characteristics = await service.getCharacteristics();
      for (const c of characteristics) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          this.txChar = c;
        }
        if (c.properties.notify || c.properties.indicate) {
          this.rxChar = c;
        }
      }

      if (this.rxChar) {
        await this.rxChar.startNotifications();
        this.rxChar.addEventListener('characteristicvaluechanged', (event) => {
          const decoder = new TextDecoder('utf-8');
          const str = decoder.decode(event.target.value);
          this.emitData(str);
        });
      }

      this.isConnected = true;
      return true;
    } catch (err) {
      this.isConnected = false;
      throw err;
    }
  }

  async write(cmd) {
    if (!this.isConnected || !this.txChar) {
      throw new Error('Dispositivo BLE no conectado o característica TX no encontrada');
    }
    const formatted = cmd.endsWith('\r') ? cmd : cmd + '\r';
    const encoder = new TextEncoder();
    const data = encoder.encode(formatted);
    await this.txChar.writeValue(data);
    return formatted;
  }

  async disconnect() {
    this.isConnected = false;
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    this.txChar = null;
    this.rxChar = null;
  }
}
