import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParkingSpotEntity } from './parking-spot.entity';
import { ParkingSpotsService } from './parking-spots.service';
import { ParkingSpotsController } from './parking-spots.controller';
import { CommunityModule } from '../community/community.module';

@Module({
  imports: [TypeOrmModule.forFeature([ParkingSpotEntity]), CommunityModule],
  providers: [ParkingSpotsService],
  controllers: [ParkingSpotsController],
  exports: [ParkingSpotsService],
})
export class ParkingSpotsModule {}
