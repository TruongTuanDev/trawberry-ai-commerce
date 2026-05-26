import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { HomepageSlidesController } from './homepage-slides.controller';
import { HomepageSlidesService } from './homepage-slides.service';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [HomepageSlidesController],
  providers: [HomepageSlidesService],
  exports: [HomepageSlidesService],
})
export class HomepageSlidesModule {}
