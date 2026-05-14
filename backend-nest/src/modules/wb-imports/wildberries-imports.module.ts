import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WildberriesExcelParserService } from './wildberries-excel-parser.service';
import { WildberriesImportsController } from './wildberries-imports.controller';
import { WildberriesImportsService } from './wildberries-imports.service';

@Module({
  imports: [PrismaModule],
  controllers: [WildberriesImportsController],
  providers: [WildberriesExcelParserService, WildberriesImportsService],
  exports: [WildberriesExcelParserService, WildberriesImportsService],
})
export class WildberriesImportsModule {}
