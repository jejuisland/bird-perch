import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('review_helpful_votes')
@Index(['reviewId', 'userId'], { unique: true })
export class ReviewHelpfulVoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reviewId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: ['helpful', 'not_helpful'] })
  value: 'helpful' | 'not_helpful';

  @CreateDateColumn()
  createdAt: Date;
}

