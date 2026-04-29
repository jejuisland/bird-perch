import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParkingSpotEntity } from './parking-spot.entity';
import { ParkingSpotsService } from './parking-spots.service';
import { ParkingSpotsController } from './parking-spots.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ParkingSpotEntity])],
  providers: [ParkingSpotsService],
  controllers: [ParkingSpotsController],
  exports: [ParkingSpotsService],
})
export class ParkingSpotsModule {}
