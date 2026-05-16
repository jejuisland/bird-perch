import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ModerationItemKind, ModerationItemStatus } from '@perch/shared';

@Entity('moderation_items')
export class ModerationItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['new_place', 'metadata_update', 'pin_move', 'photo', 'report_escalation'] })
  kind: ModerationItemKind;

  @Column({ type: 'enum', enum: ['pending', 'verified', 'rejected', 'superseded'], default: 'pending' })
  status: ModerationItemStatus;

  @Column({ type: 'uuid', nullable: true })
  targetParkingSpotId: string | null;

  @Column({ type: 'uuid', nullable: true })
  submitterUserId: string | null;

  @Column({ type: 'json', default: {} })
  payload: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  approvalScore: number;

  @Column({ type: 'int', default: 0 })
  rejectionScore: number;

  @CreateDateColumn()
  createdAt: Date;
}

