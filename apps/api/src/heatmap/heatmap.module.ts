import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeatmapPointEntity } from './heatmap-point.entity';
import { HeatmapService } from './heatmap.service';
import { HeatmapController } from './heatmap.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HeatmapPointEntity])],
  providers: [HeatmapService],
  controllers: [HeatmapController],
})
export class HeatmapModule {}
