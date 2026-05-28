import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ads')
export class AdEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  advertiserName: string | null;

  @Column({ default: 'image' })
  type: string;

  @Column({ type: 'text' })
  contentUrl: string;

  @Column({ type: 'text', nullable: true })
  targetUrl: string | null;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: 8 })
  durationSeconds: number;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
