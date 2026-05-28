import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ParkingSpotsModule } from './parking-spots/parking-spots.module';
import { ReviewsModule } from './reviews/reviews.module';
import { HeatmapModule } from './heatmap/heatmap.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CommunityModule } from './community/community.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdsModule } from './ads/ads.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'perch',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      autoLoadEntities: true,
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: process.env.NODE_ENV === 'development' ? 10000 : 60,
    }]),
    AuthModule,
    UsersModule,
    ParkingSpotsModule,
    ReviewsModule,
    HeatmapModule,
    AnalyticsModule,
    CommunityModule,
    UploadsModule,
    AdsModule,
  ],
  providers: [
    // Activate the throttler for every route in the application.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
