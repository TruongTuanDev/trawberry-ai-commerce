import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateWbCredentialsDto {
  @IsString()
  @IsNotEmpty()
  apiKey!: string;
}
