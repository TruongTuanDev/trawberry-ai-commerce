import { ApiProperty } from '@nestjs/swagger';

export class AiRuntimeStatusResponseDto {
  @ApiProperty()
  shopId!: string;

  @ApiProperty({ enum: ['internal-mock', 'ai-service'] })
  workerMode!: 'internal-mock' | 'ai-service';

  @ApiProperty({
    enum: [
      'INTERNAL_MOCK',
      'AI_SERVICE_MOCK',
      'AI_SERVICE_OPENAI_READY',
      'AI_SERVICE_OPENAI_BLOCKED',
      'OFFLINE',
    ],
  })
  effectiveMode!:
    | 'INTERNAL_MOCK'
    | 'AI_SERVICE_MOCK'
    | 'AI_SERVICE_OPENAI_READY'
    | 'AI_SERVICE_OPENAI_BLOCKED'
    | 'OFFLINE';

  @ApiProperty({
    enum: [
      'INTERNAL_MOCK',
      'AI_SERVICE_MOCK',
      'AI_SERVICE_OPENAI_READY',
      'AI_SERVICE_OPENAI_BLOCKED',
      'OFFLINE',
    ],
  })
  sellerFlowEffectiveMode!:
    | 'INTERNAL_MOCK'
    | 'AI_SERVICE_MOCK'
    | 'AI_SERVICE_OPENAI_READY'
    | 'AI_SERVICE_OPENAI_BLOCKED'
    | 'OFFLINE';

  @ApiProperty()
  supportsTaskGeneration!: boolean;

  @ApiProperty()
  supportsTaskAttach!: boolean;

  @ApiProperty()
  supportsCredits!: boolean;

  @ApiProperty()
  supportsTaskRetry!: boolean;

  @ApiProperty()
  supportsVirtualTryOn!: boolean;

  @ApiProperty()
  tryOnReady!: boolean;

  @ApiProperty()
  aiServiceConfigured!: boolean;

  @ApiProperty()
  aiServiceReachable!: boolean;

  @ApiProperty({ nullable: true })
  aiServiceProvider!: 'mock' | 'openai' | null;

  @ApiProperty({ nullable: true })
  aiServiceStorageDriver!: 'mock' | 'local' | 's3' | null;

  @ApiProperty()
  openAiConfigured!: boolean;

  @ApiProperty()
  openAiSmokeEnabled!: boolean;

  @ApiProperty()
  openAiRealEnabled!: boolean;

  @ApiProperty({ nullable: true })
  safeErrorCode!: string | null;

  @ApiProperty()
  statusMessage!: string;
}
