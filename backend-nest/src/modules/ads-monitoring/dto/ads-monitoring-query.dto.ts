import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  ADS_MONITORING_WINDOWS,
  type AdsMonitoringWindow,
} from '../ads-monitoring.constants';

export class AdsMonitoringQueryDto {
  @ApiPropertyOptional({
    enum: ADS_MONITORING_WINDOWS,
    default: '24h',
  })
  @IsOptional()
  @IsIn(ADS_MONITORING_WINDOWS)
  window: AdsMonitoringWindow = '24h';
}
