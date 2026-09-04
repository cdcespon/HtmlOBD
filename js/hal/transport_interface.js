/**
 * ApexOBD - IOBDTransport
 * Interfaz base y contrato polimórfico para los adaptadores de comunicación física y virtual.
 */
export class IOBDTransport {
  constructor() {
    this.name = 'BASE_TRANSPORT';
    this.isConnected = false;
    this.dataCallbacks = new Set();
  }

  /**
   * Inicializa y abre el canal de comunicación.
   * @returns {Promise<boolean>}
   */
  async connect() {
    throw new Error('Método connect() debe ser implementado por la subclase');
  }

  /**
   * Cierra el canal de comunicación.
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('Método disconnect() debe ser implementado por la subclase');
  }

  /**
   * Envía un comando o trama cruda al adaptador.
   * @param {string} cmd - Comando en formato ASCII (ej: "010C\r")
   * @returns {Promise<string>}
   */
  async write(cmd) {
    throw new Error('Método write() debe ser implementado por la subclase');
  }

  /**
   * Suscribe un receptor de datos entrantes desde el hardware.
   * @param {Function} callback 
   */
  onData(callback) {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }

  /**
   * Notifica a los suscriptores una trama recibida.
   * @param {string} data 
   */
  emitData(data) {
    this.dataCallbacks.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[Transport:${this.name}] Error en data callback:`, err);
      }
    });
  }
}
