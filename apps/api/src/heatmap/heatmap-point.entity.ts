import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('heatmap_points')
export class HeatmapPointEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Index()
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  // Anonymized session identifier — never tied to a user ID
  @Column()
  sessionId: string;

  @Column({ type: 'int', default: 0 })
  dwellSeconds: number;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
