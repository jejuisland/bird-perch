import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdEntity } from './ad.entity';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AdEntity])],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
