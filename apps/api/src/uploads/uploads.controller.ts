import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  // 10 presigned URLs per minute per user — blocks bulk photo farming while
  // allowing normal multi-photo submission flows.
  @Throttle({ default: { ttl: 60000, limit: process.env.NODE_ENV === 'development' ? 1000 : 10 } })
  @Post('parking-photo')
  async createParkingPhotoUpload(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.uploads.createSignedParkingPhotoUpload({
      userId: user.sub,
      contentType: dto.contentType,
      fileExt: dto.fileExt,
    });
  }
}

