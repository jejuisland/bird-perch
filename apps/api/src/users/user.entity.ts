import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleType } from '@perch/shared';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string | null;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  mobileNumber: string | null;

  @Column({ nullable: true })
  age: number | null;

  @Column({ type: 'enum', enum: ['motorcycle', 'sedan', 'suv', 'van'], nullable: true })
  vehicleType: VehicleType | null;

  @Column({ nullable: true })
  passwordHash: string | null;

  @Column({ default: false })
  emailVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
