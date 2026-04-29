import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { ParkingSpotEntity } from '../parking-spots/parking-spot.entity';

@Entity('reviews')
export class ReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  parkingSpotId: string;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ nullable: true })
  comment: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => ParkingSpotEntity)
  @JoinColumn({ name: 'parkingSpotId' })
  parkingSpot: ParkingSpotEntity;

  @CreateDateColumn()
  createdAt: Date;
}
