/**
 * ApexOBD - EventBus
 * Bus de eventos desacoplado para comunicación entre módulos y agentes.
 * Cumple con el Contrato Agéntico de ApexOBD.
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Suscribe una función callback a un evento específico.
   * @param {string} event - Nombre del evento (ej: 'telemetry:update')
   * @param {Function} callback - Función manejadora
   * @returns {Function} Función para cancelar la suscripción
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Suscribe un callback que se ejecutará una sola vez.
   * @param {string} event 
   * @param {Function} callback 
   */
  once(event, callback) {
    const unsubscribe = this.on(event, (...args) => {
      unsubscribe();
      callback(...args);
    });
    return unsubscribe;
  }

  /**
   * Cancela la suscripción de un callback.
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emite un evento a todos los suscriptores.
   * @param {string} event 
   * @param {*} payload 
   */
  emit(event, payload) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(payload);
        } catch (err) {
          console.error(`[EventBus] Error en listener para evento "${event}":`, err);
        }
      });
    }
  }

  /**
   * Limpia todos los suscriptores.
   */
  clear() {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
