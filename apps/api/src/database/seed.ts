import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { ParkingSpotEntity } from '../parking-spots/parking-spot.entity';
import { DetailedRates } from '@perch/shared';

// ─── Shared rule sets ─────────────────────────────────────────────────────────

const STANDARD_RULES = [
  'Customer unconditionally agrees to abide by all car park conditions and follow traffic directional signs.',
  'The car park owner and operator do not assume responsibility for any loss of or damage to the vehicle and its contents while inside the facility.',
  'The customer shall be held liable for any injury to person and/or any damage to property that may be caused while inside the car park.',
  'Customer is required to turn off the engine of the vehicle while parked inside the facility.',
  'No one is allowed to idle inside the vehicle while parked inside the facility.',
  'The car park operator reserves the right to tow, remove, or cause the impounding of any vehicle left inside the facility for more than 24 hours.',
  'The car park is not liable for any damage to the vehicle.',
  'For a lost parking card/ticket, present: a) Driver\'s License, b) Original Certificate of Registration (OR/CR). Lost ticket fee applies.',
  'The parking card/ticket should not be left inside the vehicle.',
  'Overnight parking surcharge applies during designated cut-off hours.',
];

// ─── Shared facility sets ─────────────────────────────────────────────────────

const MALL_BASE = ['CCTV', 'Security Guard', 'Covered', 'Accessible Parking'];
const MALL_PREMIUM = [...MALL_BASE, 'EV Charging'];
const OPEN_LOT = ['CCTV', 'Security Guard'];

// ─── Helper to build standard mall rate ──────────────────────────────────────

function mallRate(carFirst: number, carSucceeding: number, motoFirst?: number): DetailedRates {
  return {
    car: {
      firstHours: 2,
      firstRate: carFirst,
      succeedingRate: carSucceeding,
      overnightCharge: 300,
      overnightCutoff: '2:00AM–6:00AM',
    },
    motorcycle: {
      firstHours: 2,
      firstRate: motoFirst ?? 20,
      succeedingRate: 10,
      overnightCharge: 200,
      overnightCutoff: '2:00AM–6:00AM',
    },
    lostTicketFee: 300,
  };
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const seedSpots: Partial<ParkingSpotEntity>[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // BGC / TAGUIG
  // ══════════════════════════════════════════════════════════════════════════

  {
    name: 'SM Aura Premier Parking',
    address: 'McKinley Pkwy, Bonifacio Global City, Taguig',
    latitude: 14.5463,
    longitude: 121.0506,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr · ₱300 overnight',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 1200,
    facilities: MALL_PREMIUM,
    detailedRates: mallRate(50, 20),
    rules: STANDARD_RULES,
  },
  {
    name: 'Uptown Mall BGC Parking',
    address: '9th Ave cor. 36th St, Bonifacio Global City, Taguig',
    latitude: 14.5568,
    longitude: 121.0503,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr · ₱300 overnight',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 800,
    facilities: MALL_PREMIUM,
    detailedRates: mallRate(50, 20),
    rules: STANDARD_RULES,
  },
  {
    name: 'Market! Market! Parking',
    address: 'McKinley Pkwy & 26th St, Bonifacio Global City, Taguig',
    latitude: 14.5453,
    longitude: 121.0497,
    type: 'mall',
    rates: '₱40 first 2h · ₱20/hr',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_available',
    totalSlots: 600,
    facilities: MALL_BASE,
    detailedRates: {
      car: { firstHours: 2, firstRate: 40, succeedingRate: 20, overnightCharge: 300, overnightCutoff: '2:00AM–6:00AM' },
      motorcycle: { flatRate: 20, flatRateWindow: 'All day' },
      lostTicketFee: 300,
    },
    rules: STANDARD_RULES,
  },
  {
    name: 'DoubleDragon Plaza BGC Parking',
    address: 'Meridian Blvd, Bonifacio Global City, Taguig',
    latitude: 14.5495,
    longitude: 121.0471,
    type: 'mall',
    rates: '₱35 first 3h · ₱15/hr · Moto ₱30 first 3h',
    operatingHours: '24 hours',
    status: 'usually_available',
    totalSlots: 400,
    facilities: ['CCTV', 'Security Guard', 'Covered'],
    detailedRates: {
      car: {
        firstHours: 3,
        firstRate: 35,
        succeedingRate: 15,
        overnightCharge: 300,
        overnightCutoff: '2:00AM–6:00AM',
      },
      motorcycle: {
        firstHours: 3,
        firstRate: 30,
        succeedingRate: 20,
        overnightCharge: 200,
        overnightCutoff: '2:00AM–6:00AM',
      },
      lostTicketFee: 300,
    },
    rules: [
      ...STANDARD_RULES,
      'Customers with lost parking card/ticket are charged ₱300 in addition to the parking fee for time spent in the facility.',
    ],
  },
  {
    name: 'Bonifacio High Street Parking',
    address: '28th St cor. 5th Ave, Bonifacio Global City, Taguig',
    latitude: 14.5508,
    longitude: 121.0481,
    type: 'street',
    rates: '₱50/hr for cars · ₱20/hr for motorcycles',
    operatingHours: '7:00 AM – 11:00 PM',
    status: 'usually_busy',
    totalSlots: 120,
    facilities: OPEN_LOT,
    detailedRates: {
      car: { succeedingRate: 50 },
      motorcycle: { succeedingRate: 20 },
    },
    rules: STANDARD_RULES.slice(0, 6),
  },
  {
    name: 'Serendra Private Lot',
    address: '5th Ave, Serendra, Bonifacio Global City, Taguig',
    latitude: 14.5509,
    longitude: 121.0453,
    type: 'private_lot',
    rates: '₱30/hr · Residents get priority',
    operatingHours: '24 hours',
    status: 'usually_available',
    totalSlots: 200,
    facilities: ['CCTV', 'Security Guard', 'Covered', 'Gated'],
    detailedRates: {
      car: { succeedingRate: 30 },
    },
    rules: STANDARD_RULES,
  },
  {
    name: 'One BGC Parking',
    address: '5th Ave, Bonifacio Global City, Taguig',
    latitude: 14.5494,
    longitude: 121.0478,
    type: 'private_lot',
    rates: '₱50 first 2h · ₱25/hr · ₱300 overnight',
    operatingHours: '24 hours',
    status: 'usually_available',
    totalSlots: 350,
    facilities: MALL_PREMIUM,
    detailedRates: {
      car: { firstHours: 2, firstRate: 50, succeedingRate: 25, overnightCharge: 300, overnightCutoff: '2:00AM–6:00AM' },
      motorcycle: { firstHours: 2, firstRate: 20, succeedingRate: 10 },
      lostTicketFee: 300,
    },
    rules: STANDARD_RULES,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MAKATI
  // ══════════════════════════════════════════════════════════════════════════

  {
    name: 'Ayala Center Parking',
    address: 'Ayala Ave cor. Makati Ave, Makati CBD',
    latitude: 14.5521,
    longitude: 121.0201,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr · Free 30 min',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 2000,
    facilities: MALL_PREMIUM,
    detailedRates: {
      car: {
        freeMinutes: 30,
        firstHours: 2,
        firstRate: 50,
        succeedingRate: 20,
        overnightCharge: 300,
        overnightCutoff: '2:00AM–6:00AM',
      },
      motorcycle: {
        freeMinutes: 30,
        firstHours: 2,
        firstRate: 20,
        succeedingRate: 10,
      },
      lostTicketFee: 300,
    },
    rules: STANDARD_RULES,
  },
  {
    name: 'Greenbelt Parking Complex',
    address: 'Greenbelt, Ayala Center, Makati',
    latitude: 14.5507,
    longitude: 121.0190,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 1500,
    facilities: MALL_BASE,
    detailedRates: mallRate(50, 20),
    rules: STANDARD_RULES,
  },
  {
    name: 'Power Plant Mall Rockwell Parking',
    address: 'Rockwell Dr, Rockwell Center, Makati',
    latitude: 14.5662,
    longitude: 121.0338,
    type: 'mall',
    rates: '₱50 first 2h · ₱25/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_available',
    totalSlots: 700,
    facilities: [...MALL_PREMIUM, 'Valet Parking'],
    detailedRates: {
      car: { firstHours: 2, firstRate: 50, succeedingRate: 25, overnightCharge: 300, overnightCutoff: '2:00AM–6:00AM' },
      motorcycle: { firstHours: 2, firstRate: 20, succeedingRate: 10 },
      lostTicketFee: 500,
    },
    rules: STANDARD_RULES,
  },
  {
    name: 'Century City Mall Parking',
    address: 'Kalayaan Ave, Poblacion, Makati',
    latitude: 14.5680,
    longitude: 121.0285,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_available',
    totalSlots: 500,
    facilities: MALL_PREMIUM,
    detailedRates: mallRate(50, 20),
    rules: STANDARD_RULES,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ORTIGAS CENTER
  // ══════════════════════════════════════════════════════════════════════════

  {
    name: 'SM Megamall Parking',
    address: 'EDSA cor. Julia Vargas Ave, Mandaluyong',
    latitude: 14.5862,
    longitude: 121.0574,
    type: 'mall',
    rates: '₱40 first 2h · ₱20/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 2500,
    facilities: MALL_BASE,
    detailedRates: mallRate(40, 20),
    rules: STANDARD_RULES,
  },
  {
    name: 'Robinsons Galleria Parking',
    address: 'EDSA cor. Ortigas Ave, Quezon City',
    latitude: 14.5875,
    longitude: 121.0563,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 1200,
    facilities: MALL_BASE,
    detailedRates: mallRate(50, 20),
    rules: STANDARD_RULES,
  },
  {
    name: 'The Podium Parking',
    address: 'ADB Ave, Ortigas Center, Pasig',
    latitude: 14.5886,
    longitude: 121.0558,
    type: 'mall',
    rates: '₱60 first 2h · ₱25/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_available',
    totalSlots: 500,
    facilities: [...MALL_PREMIUM, 'Valet Parking'],
    detailedRates: {
      car: { firstHours: 2, firstRate: 60, succeedingRate: 25, overnightCharge: 300, overnightCutoff: '2:00AM–6:00AM' },
      motorcycle: { firstHours: 2, firstRate: 25, succeedingRate: 15 },
      lostTicketFee: 500,
    },
    rules: STANDARD_RULES,
  },
  {
    name: 'Shangri-La Plaza Parking',
    address: 'EDSA cor. Shaw Blvd, Mandaluyong',
    latitude: 14.5869,
    longitude: 121.0568,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr · Free 30 min',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 800,
    facilities: [...MALL_BASE, 'Valet Parking'],
    detailedRates: {
      car: { freeMinutes: 30, firstHours: 2, firstRate: 50, succeedingRate: 20, overnightCharge: 300, overnightCutoff: '2:00AM–6:00AM' },
      motorcycle: { firstHours: 2, firstRate: 20, succeedingRate: 10 },
      lostTicketFee: 300,
    },
    rules: STANDARD_RULES,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // QUEZON CITY
  // ══════════════════════════════════════════════════════════════════════════

  {
    name: 'SM North EDSA Parking',
    address: 'North Ave, Quezon City',
    latitude: 14.6569,
    longitude: 121.0322,
    type: 'mall',
    rates: '₱40 first 2h · ₱20/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 3000,
    facilities: MALL_BASE,
    detailedRates: mallRate(40, 20),
    rules: STANDARD_RULES,
  },
  {
    name: 'TriNoma Mall Parking',
    address: 'EDSA cor. North Ave, Quezon City',
    latitude: 14.6574,
    longitude: 121.0319,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr · ₱300 overnight',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 2000,
    facilities: [...MALL_BASE, 'EV Charging'],
    detailedRates: mallRate(50, 20),
    rules: STANDARD_RULES,
  },
  {
    name: 'Eastwood Mall Parking',
    address: 'Eastwood Ave, Libis, Quezon City',
    latitude: 14.6075,
    longitude: 121.0797,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_available',
    totalSlots: 600,
    facilities: MALL_BASE,
    detailedRates: mallRate(50, 20),
    rules: STANDARD_RULES,
  },
  {
    name: 'Robinsons Magnolia Parking',
    address: 'Aurora Blvd cor. Doña Hemady Ave, New Manila, Quezon City',
    latitude: 14.6195,
    longitude: 121.0276,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_available',
    totalSlots: 700,
    facilities: MALL_BASE,
    detailedRates: mallRate(50, 20),
    rules: STANDARD_RULES,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PASAY / BAY AREA
  // ══════════════════════════════════════════════════════════════════════════

  {
    name: 'SM Mall of Asia Parking',
    address: 'J.W. Diokno Blvd, Mall of Asia Complex, Pasay',
    latitude: 14.5354,
    longitude: 120.9829,
    type: 'mall',
    rates: '₱40 first 2h · ₱20/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_busy',
    totalSlots: 4000,
    facilities: MALL_PREMIUM,
    detailedRates: mallRate(40, 20),
    rules: STANDARD_RULES,
  },
  {
    name: 'Newport World Resorts Parking',
    address: 'Newport Blvd, Newport City, Pasay',
    latitude: 14.5095,
    longitude: 121.0157,
    type: 'mall',
    rates: '₱60 first 2h · ₱30/hr after · Open 24h',
    operatingHours: '24 hours',
    status: 'usually_available',
    totalSlots: 1500,
    facilities: [...MALL_PREMIUM, 'Valet Parking', 'Car Wash'],
    detailedRates: {
      car: {
        freeMinutes: 15,
        firstHours: 2,
        firstRate: 60,
        succeedingRate: 30,
        overnightCharge: 300,
        overnightCutoff: '1:30AM–6:00AM',
      },
      motorcycle: {
        freeMinutes: 15,
        firstHours: 2,
        firstRate: 25,
        succeedingRate: 15,
        overnightCharge: 200,
        overnightCutoff: '1:30AM–6:00AM',
      },
      lostTicketFee: 500,
    },
    rules: STANDARD_RULES,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MANILA
  // ══════════════════════════════════════════════════════════════════════════

  {
    name: 'Robinsons Place Manila Parking',
    address: 'Pedro Gil cor. Adriatico St, Ermita, Manila',
    latitude: 14.5773,
    longitude: 120.9883,
    type: 'mall',
    rates: '₱50 first 2h · ₱20/hr after',
    operatingHours: '10:00 AM – 10:00 PM',
    status: 'usually_available',
    totalSlots: 800,
    facilities: MALL_BASE,
    detailedRates: mallRate(50, 20),
    rules: STANDARD_RULES,
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function seed() {
  await AppDataSource.initialize();
  await AppDataSource.synchronize();

  const repo = AppDataSource.getRepository(ParkingSpotEntity);

  for (const spot of seedSpots) {
    const existing = await repo.findOne({ where: { name: spot.name } });
    if (existing) {
      await repo.save({ ...existing, ...spot });
      console.log(`Updated: ${spot.name}`);
    } else {
      await repo.save(repo.create(spot));
      console.log(`Seeded: ${spot.name}`);
    }
  }

  console.log(`\nSeed complete — ${seedSpots.length} parking spots processed`);
  await AppDataSource.destroy();
}

seed().catch(console.error);
