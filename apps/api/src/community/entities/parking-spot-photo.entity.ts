import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('parking_spot_photos')
@Index(['parkingSpotId'])
export class ParkingSpotPhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  parkingSpotId: string;

  @Column({ type: 'uuid' })
  uploadedByUserId: string;

  @Column()
  storagePath: string;

  @Column()
  publicUrl: string;

  @Column({ type: 'timestamptz', nullable: true })
  communityApprovedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

