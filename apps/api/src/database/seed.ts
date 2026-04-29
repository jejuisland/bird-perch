import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { ParkingSpotEntity } from '../parking-spots/parking-spot.entity';

const seedSpots: Partial<ParkingSpotEntity>[] = [
  {
    name: 'Ayala Center Parking',
    latitude: 14.5547,
    longitude: 121.0244,
    type: 'mall',
    rates: '₱50/hr',
    operatingHours: '10:00 AM - 10:00 PM',
    status: 'usually_busy',
  },
  {
    name: 'BGC Street Parking - 5th Ave',
    latitude: 14.5494,
    longitude: 121.0478,
    type: 'street',
    rates: '₱25/hr',
    operatingHours: '6:00 AM - 10:00 PM',
    status: 'usually_available',
  },
  {
    name: 'SM Aura Parking',
    latitude: 14.5463,
    longitude: 121.0506,
    type: 'mall',
    rates: '₱40/hr',
    operatingHours: '10:00 AM - 10:00 PM',
    status: 'usually_busy',
  },
  {
    name: 'Serendra Private Lot',
    latitude: 14.5509,
    longitude: 121.0453,
    type: 'private_lot',
    rates: '₱30/hr',
    operatingHours: '24 hours',
    status: 'usually_available',
  },
  {
    name: 'Bonifacio High Street Parking',
    latitude: 14.5508,
    longitude: 121.0481,
    type: 'street',
    rates: '₱25/hr',
    operatingHours: '7:00 AM - 11:00 PM',
    status: 'unknown',
  },
];

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(ParkingSpotEntity);
  for (const spot of seedSpots) {
    const exists = await repo.findOne({ where: { name: spot.name } });
    if (!exists) {
      await repo.save(repo.create(spot));
      console.log(`Seeded: ${spot.name}`);
    }
  }
  console.log('Seed complete');
  await AppDataSource.destroy();
}

seed().catch(console.error);
