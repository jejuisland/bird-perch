import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ContributorTier } from '@perch/shared';
import { UserEntity } from '../../users/user.entity';

@Entity('contributor_stats')
export class ContributorStatsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ type: 'enum', enum: ['pigeon', 'hawk', 'eagle'], default: 'pigeon' })
  tier: ContributorTier;

  @Column({ type: 'int', default: 0 })
  contributionPoints: number;

  @Column({ type: 'int', default: 0 })
  verifiedPlacesCount: number;

  @Column({ type: 'int', default: 0 })
  acceptedReviewsCount: number;

  @Column({ type: 'int', default: 0 })
  acceptedPhotosCount: number;

  @Column({ type: 'int', default: 0 })
  acceptedUpdatesCount: number;

  @Column({ type: 'int', default: 0 })
  moderationVotesCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  moderationAccuracy: number | null;

  @Column({ type: 'int', nullable: true })
  contributionStreakDays: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastContributionAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

