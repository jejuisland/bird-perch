import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('moderation_votes')
@Index(['moderationItemId', 'userId'], { unique: true })
export class ModerationVoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  moderationItemId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'boolean' })
  approve: boolean;

  @Column({ type: 'smallint' })
  weight: number;

  @Column({ type: 'enum', enum: ['pending', 'verified', 'rejected', 'superseded'], nullable: true })
  resolvedStatus: 'pending' | 'verified' | 'rejected' | 'superseded' | null;

  @Column({ type: 'boolean', nullable: true })
  isCorrect: boolean | null;

  @CreateDateColumn()
  createdAt: Date;
}

