import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ParkingType, ParkingStatus } from '@perch/shared';

@Entity('parking_spots')
export class ParkingSpotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'enum', enum: ['street', 'mall', 'private_lot'], default: 'street' })
  type: ParkingType;

  @Column({ nullable: true })
  rates: string;

  @Column({ nullable: true })
  operatingHours: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  reviewCount: number;

  @Column({
    type: 'enum',
    enum: ['usually_busy', 'usually_available', 'unknown'],
    default: 'unknown',
  })
  status: ParkingStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
