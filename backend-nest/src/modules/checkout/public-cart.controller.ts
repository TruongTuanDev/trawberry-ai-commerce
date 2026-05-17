import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartValidationResponseDto } from './dto/cart-validation-response.dto';
import { ValidateCartDto } from './dto/validate-cart.dto';
import { CartValidationService } from './cart-validation.service';

@ApiTags('public-cart')
@Controller('api/public/cart')
export class PublicCartController {
  constructor(private readonly cartValidationService: CartValidationService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Validate public cart items against current product visibility, stock, and price.',
  })
  @ApiOkResponse({ type: CartValidationResponseDto })
  async validate(@Body() dto: ValidateCartDto) {
    const result = await this.cartValidationService.validateItems(dto.items);
    return this.cartValidationService.toResponse(result);
  }
}
