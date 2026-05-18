import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reports')
@Index(['reporterUserId', 'dayKey'])
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reporterUserId: string;

  @Column({ type: 'enum', enum: ['review', 'photo', 'update'] })
  targetType: 'review' | 'photo' | 'update';

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({ nullable: true })
  reason: string | null;

  // YYYY-MM-DD in Asia/Manila time for daily limit checks.
  @Column()
  dayKey: string;

  @CreateDateColumn()
  createdAt: Date;
}

