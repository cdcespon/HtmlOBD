/**
 * ApexOBD - OBD Constants, PIDs & DTC Database
 * Catálogo estándar SAE J1979 / ISO 15031-5 y comandos ELM327.
 */

// Comandos AT de inicialización y configuración
export const AT_COMMANDS = {
  RESET: 'ATZ',
  ECHO_OFF: 'ATE0',
  LINEFEEDS_OFF: 'ATL0',
  HEADERS_OFF: 'ATH0',
  SPACES_OFF: 'ATS0',
  AUTO_PROTOCOL: 'ATSP0',
  READ_VOLTAGE: 'ATRV',
  DESCRIBE_PROTOCOL: 'ATDP'
};

// Modos / Servicios OBD2 estándar
export const OBD_SERVICES = {
  CURRENT_DATA: '01',
  FREEZE_FRAME: '02',
  SHOW_DTC: '03',
  CLEAR_DTC: '04',
  O2_MONITOR: '05',
  TEST_RESULTS: '06',
  PENDING_DTC: '07',
  VEHICLE_INFO: '09'
};

// Definición de PIDs Modo 01 con sus decodificadores y rangos
export const OBD_PIDS = {
  ENGINE_LOAD: {
    pid: '04',
    name: 'Carga del Motor',
    unit: '%',
    min: 0,
    max: 100,
    decode: (bytes) => (bytes[0] * 100) / 255
  },
  COOLANT_TEMP: {
    pid: '05',
    name: 'Temp. Refrigerante',
    unit: '°C',
    min: -40,
    max: 140,
    decode: (bytes) => bytes[0] - 40
  },
  SHORT_FUEL_TRIM_1: {
    pid: '06',
    name: 'Ajuste Combustible Corto B1',
    unit: '%',
    min: -100,
    max: 99.2,
    decode: (bytes) => (bytes[0] - 128) * (100 / 128)
  },
  INTAKE_PRESSURE: {
    pid: '0B',
    name: 'Presión Múltiple Admisión (MAP)',
    unit: 'kPa',
    min: 0,
    max: 255,
    decode: (bytes) => bytes[0]
  },
  ENGINE_RPM: {
    pid: '0C',
    name: 'Régimen de Giro (RPM)',
    unit: 'RPM',
    min: 0,
    max: 8000,
    decode: (bytes) => ((bytes[0] * 256) + bytes[1]) / 4
  },
  VEHICLE_SPEED: {
    pid: '0D',
    name: 'Velocidad',
    unit: 'km/h',
    min: 0,
    max: 260,
    decode: (bytes) => bytes[0]
  },
  TIMING_ADVANCE: {
    pid: '0E',
    name: 'Avance de Encendido',
    unit: '°',
    min: -64,
    max: 63.5,
    decode: (bytes) => (bytes[0] / 2) - 64
  },
  INTAKE_AIR_TEMP: {
    pid: '0F',
    name: 'Temp. Aire Admisión (IAT)',
    unit: '°C',
    min: -40,
    max: 120,
    decode: (bytes) => bytes[0] - 40
  },
  MAF_FLOW_RATE: {
    pid: '10',
    name: 'Flujo de Aire (MAF)',
    unit: 'g/s',
    min: 0,
    max: 250,
    decode: (bytes) => ((bytes[0] * 256) + bytes[1]) / 100
  },
  THROTTLE_POS: {
    pid: '11',
    name: 'Posición del Acelerador (TPS)',
    unit: '%',
    min: 0,
    max: 100,
    decode: (bytes) => (bytes[0] * 100) / 255
  },
  FUEL_LEVEL: {
    pid: '2F',
    name: 'Nivel de Combustible',
    unit: '%',
    min: 0,
    max: 100,
    decode: (bytes) => (bytes[0] * 100) / 255
  },
  BAROMETRIC_PRESSURE: {
    pid: '33',
    name: 'Presión Barométrica',
    unit: 'kPa',
    min: 0,
    max: 255,
    decode: (bytes) => bytes[0]
  },
  OIL_TEMP: {
    pid: '5C',
    name: 'Temp. Aceite Motor',
    unit: '°C',
    min: -40,
    max: 150,
    decode: (bytes) => bytes[0] - 40
  }
};

// Base de datos de códigos de falla DTC frecuentes con severidad y recomendaciones
export const DTC_DATABASE = {
  'P0101': {
    system: 'Motor / Admisión',
    description: 'Rendimiento / Rango del circuito del flujo de masa de aire (MAF)',
    severity: 'MEDIUM',
    tip: 'Limpiar o sustituir el sensor MAF. Revisar posibles fugas de aire en el conducto de admisión.'
  },
  'P0113': {
    system: 'Motor / Sensores',
    description: 'Circuito del sensor de temperatura del aire de admisión 1 alto',
    severity: 'LOW',
    tip: 'Comprobar el conector y cableado del sensor IAT o reemplazar el sensor.'
  },
  'P0128': {
    system: 'Refrigeración',
    description: 'Termostato de refrigerante por debajo de la temperatura regulada',
    severity: 'LOW',
    tip: 'El termostato suele quedarse abierto. Sustituir la válvula termostática.'
  },
  'P0171': {
    system: 'Combustible / Emisiones',
    description: 'Sistema demasiado pobre (Banco 1 - Mezcla con exceso de aire)',
    severity: 'HIGH',
    tip: 'Revisar fugas de vacío, presión de bomba de nafta/gasolina o inyectores sucios.'
  },
  'P0300': {
    system: 'Encendido / Cilindros',
    description: 'Fallo de encendido detectado en cilindros múltiples / aleatorios',
    severity: 'HIGH',
    tip: 'Revisar estado general de bujías, cables de encendido y presión de combustible.'
  },
  'P0301': {
    system: 'Encendido / Cilindro 1',
    description: 'Fallo de combustión detectado en el cilindro 1',
    severity: 'HIGH',
    tip: 'Inspeccionar bujía del cilindro 1 y comprobar bobina de encendido.'
  },
  'P0302': {
    system: 'Encendido / Cilindro 2',
    description: 'Fallo de combustión detectado en el cilindro 2',
    severity: 'HIGH',
    tip: 'Reemplazar bujía o intercambiar bobina con cilindro 1 para aislar la falla.'
  },
  'P0420': {
    system: 'Escape / Emisiones',
    description: 'Eficiencia del sistema catalizador por debajo del umbral (Banco 1)',
    severity: 'MEDIUM',
    tip: 'Revisar sensor de oxígeno downstream (O2) o verificar obstrucción del catalizador.'
  },
  'P0500': {
    system: 'Transmisión / Velocidad',
    description: 'Sensor de velocidad del vehículo (VSS) - Mal funcionamiento',
    severity: 'MEDIUM',
    tip: 'Comprobar conector del sensor VSS en caja de cambios o cableado hacia la ECU.'
  },
  'P0700': {
    system: 'Transmisión Automática',
    description: 'Sistema de control de transmisión (Solicitud de encendido MIL)',
    severity: 'HIGH',
    tip: 'Escanear códigos específicos del módulo TCM de la caja de cambios.'
  },
  'B0001': {
    system: 'Carrocería / Airbags',
    description: 'Control de despliegue de airbag del conductor etapa 1',
    severity: 'HIGH',
    tip: 'Revisar cinta espiral del volante (clockspring). Sistema de seguridad crítico.'
  },
  'C0035': {
    system: 'Frenos / ABS',
    description: 'Circuito del sensor de velocidad de rueda delantera izquierda',
    severity: 'MEDIUM',
    tip: 'Limpiar o sustituir el sensor ABS de la rueda delantera izquierda.'
  }
};
