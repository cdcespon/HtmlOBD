/**
 * HtmlOBD - Catálogo de Vehículos de Argentina & Decodificador VIN
 * Modelos líderes del parque automotor argentino con calibraciones técnicas.
 */

export const ARGENTINA_VEHICLES = [
  {
    id: 'toyota_hilux_28',
    brand: 'Toyota',
    model: 'Hilux 2.8 D-4D',
    year: 2023,
    engine: '2.8L Turbodiésel (1GD-FTV)',
    fuelType: 'Diésel',
    powerHp: 204,
    torqueNm: 500,
    weightKg: 2090,
    displacementCc: 2755,
    redlineRpm: 4400,
    maxGaugeRpm: 6000,
    vinPrefix: '8AJ', // Toyota Argentina (Zárate)
    description: 'Pick-up líder indiscutida del mercado argentino fabricada en Zárate, Bs. As.'
  },
  {
    id: 'fiat_cronos_13',
    brand: 'Fiat',
    model: 'Cronos 1.3 FireFly',
    year: 2023,
    engine: '1.3L 8V FireFly',
    fuelType: 'Nafta',
    powerHp: 99,
    torqueNm: 127,
    weightKg: 1140,
    displacementCc: 1332,
    redlineRpm: 6000,
    maxGaugeRpm: 8000,
    vinPrefix: '8AP', // Fiat / Stellantis Ferreyra, Córdoba
    description: 'El auto más vendido de Argentina durante años, producido en Ferreyra, Córdoba.'
  },
  {
    id: 'peugeot_208_16',
    brand: 'Peugeot',
    model: '208 1.6 VTi / 1.0 Turbo',
    year: 2023,
    engine: '1.6L 16V VTi',
    fuelType: 'Nafta',
    powerHp: 115,
    torqueNm: 150,
    weightKg: 1155,
    displacementCc: 1587,
    redlineRpm: 6200,
    maxGaugeRpm: 8000,
    vinPrefix: '8AD', // Peugeot / Stellantis El Palomar
    description: 'Hatchback compacto de gran éxito fabricado en El Palomar, Buenos Aires.'
  },
  {
    id: 'vw_amarok_v6',
    brand: 'Volkswagen',
    model: 'Amarok 3.0 V6 TDI',
    year: 2023,
    engine: '3.0L V6 Turbodiésel',
    fuelType: 'Diésel',
    powerHp: 258,
    torqueNm: 580,
    weightKg: 2185,
    displacementCc: 2967,
    redlineRpm: 4600,
    maxGaugeRpm: 6000,
    vinPrefix: '8AW', // Volkswagen Argentina (Pacheco)
    description: 'Pick-up mediana de alto rendimiento fabricada en General Pacheco.'
  },
  {
    id: 'ford_ranger_v6',
    brand: 'Ford',
    model: 'Ranger 3.0 V6 EcoBlue',
    year: 2024,
    engine: '3.0L V6 Turbodiésel EcoBlue',
    fuelType: 'Diésel',
    powerHp: 250,
    torqueNm: 600,
    weightKg: 2280,
    displacementCc: 2993,
    redlineRpm: 4500,
    maxGaugeRpm: 6000,
    vinPrefix: '8AF', // Ford Argentina (Pacheco)
    description: 'Nueva generación de la pick-up global producida en la planta de Pacheco.'
  },
  {
    id: 'chevrolet_cruze_14t',
    brand: 'Chevrolet',
    model: 'Cruze 1.4 Turbo',
    year: 2022,
    engine: '1.4L Turbo Ecotec SIDI',
    fuelType: 'Nafta',
    powerHp: 153,
    torqueNm: 245,
    weightKg: 1300,
    displacementCc: 1399,
    redlineRpm: 6000,
    maxGaugeRpm: 8000,
    vinPrefix: '8AG', // General Motors Alvear (Rosario)
    description: 'Sedán y hatchback mediano turbo fabricado en el complejo Alvear, Santa Fe.'
  },
  {
    id: 'vw_polo_16',
    brand: 'Volkswagen',
    model: 'Polo / Gol Trend 1.6 MSI',
    year: 2022,
    engine: '1.6L 16V MSI',
    fuelType: 'Nafta',
    powerHp: 110,
    torqueNm: 155,
    weightKg: 1080,
    displacementCc: 1598,
    redlineRpm: 6200,
    maxGaugeRpm: 8000,
    vinPrefix: '9BW', // Volkswagen Brasil / Mercosur
    description: 'Vehículo compacto referente de entrada de gama del Mercosur.'
  },
  {
    id: 'toyota_corolla_20',
    brand: 'Toyota',
    model: 'Corolla 2.0 Dynamic Force',
    year: 2023,
    engine: '2.0L Dual VVT-iE (M20A-FKS)',
    fuelType: 'Nafta',
    powerHp: 170,
    torqueNm: 200,
    weightKg: 1350,
    displacementCc: 1987,
    redlineRpm: 6600,
    maxGaugeRpm: 8000,
    vinPrefix: '9BR', // Toyota Brasil (Indaiatuba)
    description: 'Sedán mediano más vendido del segmento C en el mercado argentino.'
  },
  {
    id: 'renault_kangoo_16',
    brand: 'Renault',
    model: 'Kangoo II 1.6 SCe',
    year: 2023,
    engine: '1.6L 16V HR16DE (SCe)',
    fuelType: 'Nafta',
    powerHp: 114,
    torqueNm: 156,
    weightKg: 1260,
    displacementCc: 1598,
    redlineRpm: 6000,
    maxGaugeRpm: 8000,
    vinPrefix: '8A1', // Renault Santa Isabel (Córdoba)
    description: 'Furgón y utilitario multipropósito fabricado en Santa Isabel, Córdoba.'
  },
  {
    id: 'ford_focus_20',
    brand: 'Ford',
    model: 'Focus III 2.0 Duratec GDI',
    year: 2018,
    engine: '2.0L Duratec Inyección Directa',
    fuelType: 'Nafta',
    powerHp: 170,
    torqueNm: 202,
    weightKg: 1360,
    displacementCc: 1999,
    redlineRpm: 6500,
    maxGaugeRpm: 8000,
    vinPrefix: '8AF', // Ford Argentina
    description: 'Emblemático referente del segmento mediano producido en Pacheco hasta 2019.'
  }
];

// Tabla de decodificación de WMI (País y Fabricante)
const WMI_TABLE = {
  '8AJ': { country: 'Argentina', brand: 'Toyota', plant: 'Zárate, Bs. As.' },
  '8AF': { country: 'Argentina', brand: 'Ford', plant: 'Gral. Pacheco, Bs. As.' },
  '8AW': { country: 'Argentina', brand: 'Volkswagen', plant: 'Gral. Pacheco, Bs. As.' },
  '8AG': { country: 'Argentina', brand: 'General Motors', plant: 'Alvear, Santa Fe' },
  '8AD': { country: 'Argentina', brand: 'Peugeot / Citroën', plant: 'El Palomar, Bs. As.' },
  '8AP': { country: 'Argentina', brand: 'Fiat / Stellantis', plant: 'Ferreyra, Córdoba' },
  '8A1': { country: 'Argentina', brand: 'Renault', plant: 'Santa Isabel, Córdoba' },
  '9BW': { country: 'Brasil', brand: 'Volkswagen', plant: 'São Bernardo do Campo' },
  '9BR': { country: 'Brasil', brand: 'Toyota', plant: 'Indaiatuba / Sorocaba' },
  '9BD': { country: 'Brasil', brand: 'Fiat', plant: 'Betim, Minas Gerais' },
  '1HG': { country: 'Estados Unidos', brand: 'Honda', plant: 'Marysville, Ohio' },
  'WBA': { country: 'Alemania', brand: 'BMW', plant: 'Múnich, Alemania' },
  'WVW': { country: 'Alemania', brand: 'Volkswagen', plant: 'Wolfsburg, Alemania' }
};

// Tabla de año de modelo (Carácter 10 del VIN)
const VIN_YEAR_TABLE = {
  'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
  'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
  'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
  'S': 2025, 'T': 2026
};

/**
 * Decodifica un número VIN de 17 caracteres.
 */
export function decodeVin(vinRaw) {
  if (!vinRaw) return null;
  const vin = vinRaw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (vin.length !== 17) {
    return {
      valid: false,
      raw: vin,
      error: `El VIN debe tener exactamente 17 caracteres (detectados: ${vin.length})`
    };
  }

  const wmi = vin.substring(0, 3);
  const wmiInfo = WMI_TABLE[wmi] || { country: 'Desconocido', brand: 'Fabricante Genérico', plant: 'No especificada' };
  
  const yearChar = vin.charAt(9);
  const year = VIN_YEAR_TABLE[yearChar] || 'Año no determinado';

  // Intentar emparejar con un vehículo del catálogo argentino
  const matched = ARGENTINA_VEHICLES.find(v => v.vinPrefix === wmi) || null;

  return {
    valid: true,
    vin,
    wmi,
    country: wmiInfo.country,
    brand: wmiInfo.brand,
    assemblyPlant: wmiInfo.plant,
    modelYear: year,
    serialNumber: vin.substring(11),
    matchedProfile: matched
  };
}
