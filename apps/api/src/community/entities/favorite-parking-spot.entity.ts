import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('favorite_parking_spots')
@Index(['userId', 'parkingSpotId'], { unique: true })
export class FavoriteParkingSpotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  parkingSpotId: string;

  @CreateDateColumn()
  createdAt: Date;
}

