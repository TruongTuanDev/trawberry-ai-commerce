import { PartialType } from '@nestjs/swagger';
import { CreateHomepageSlideDto } from './create-homepage-slide.dto';

export class UpdateHomepageSlideDto extends PartialType(
  CreateHomepageSlideDto,
) {}
