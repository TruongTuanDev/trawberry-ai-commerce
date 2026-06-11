import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type RecommendationTuningPreset } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateRecommendationTuningPresetDto,
  UpdateRecommendationTuningPresetDto,
} from './dto/recommendation-tuning.dto';
import {
  DEFAULT_RECOMMENDATION_TUNING_GUARDRAILS,
  DEFAULT_RECOMMENDATION_TUNING_WEIGHTS,
  RECOMMENDATION_TUNING_ACTIVE_PRESET_FLAG,
  RECOMMENDATION_TUNING_CORE_WEIGHT_KEYS,
  RECOMMENDATION_TUNING_LIMITS,
  RECOMMENDATION_TUNING_PRESETS_FLAG,
  RECOMMENDATION_TUNING_WORKFLOW_FLAG,
  type RecommendationTuningConfig,
  type RecommendationTuningGuardrails,
  type RecommendationTuningWeights,
} from './recommendation-tuning-config';

@Injectable()
export class RecommendationTuningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getWorkflowFlags() {
    return {
      workflowEnabled: this.readFlag(RECOMMENDATION_TUNING_WORKFLOW_FLAG),
      presetsEnabled: this.readFlag(RECOMMENDATION_TUNING_PRESETS_FLAG),
      activePresetEnabled: this.readFlag(
        RECOMMENDATION_TUNING_ACTIVE_PRESET_FLAG,
      ),
    };
  }

  assertWorkflowEnabled() {
    if (!this.readFlag(RECOMMENDATION_TUNING_WORKFLOW_FLAG)) {
      throw new NotFoundException();
    }
  }

  async listPresets() {
    this.assertWorkflowEnabled();
    const presets = await this.prisma.recommendationTuningPreset.findMany({
      orderBy: [{ updatedAt: 'desc' }, { version: 'desc' }],
    });
    return {
      flags: this.getWorkflowFlags(),
      presets: presets.map((preset) => this.mapPreset(preset)),
    };
  }

  async getPreset(id: string) {
    this.assertWorkflowEnabled();
    const preset = await this.prisma.recommendationTuningPreset.findUnique({
      where: { id },
    });
    if (!preset) {
      throw new NotFoundException(`Tuning preset ${id} was not found.`);
    }
    const versions = await this.prisma.recommendationTuningPreset.findMany({
      where: { presetKey: preset.presetKey },
      orderBy: { version: 'desc' },
    });
    const auditLogs = await this.prisma.recommendationTuningAuditLog.findMany({
      where: { preset: { presetKey: preset.presetKey } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      flags: this.getWorkflowFlags(),
      preset: this.mapPreset(preset),
      versions: versions.map((version) => this.mapPreset(version)),
      auditLogs: auditLogs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  async createPreset(
    dto: CreateRecommendationTuningPresetDto,
    actorAdminId: string,
  ) {
    this.assertPresetManagementEnabled();
    this.validatePreset(dto.weights, dto.guardrails);
    const presetKey = randomUUID();
    const preset = await this.prisma.$transaction(async (tx) => {
      const created = await tx.recommendationTuningPreset.create({
        data: {
          presetKey,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          status: 'draft',
          version: 1,
          weights: this.toJson(dto.weights),
          guardrails: this.toJson(dto.guardrails),
          createdByAdminId: actorAdminId,
        },
      });
      await this.writeAudit(
        created.id,
        'created',
        actorAdminId,
        null,
        created,
        tx,
      );
      return created;
    });
    return this.mapPreset(preset);
  }

  async updatePreset(
    id: string,
    dto: UpdateRecommendationTuningPresetDto,
    actorAdminId: string,
  ) {
    this.assertPresetManagementEnabled();
    const existing = await this.getPresetRecord(id);
    const existingWeights = this.readWeights(existing.weights);
    const existingGuardrails = this.readGuardrails(existing.guardrails);
    const weights = { ...existingWeights, ...(dto.weights ?? {}) };
    const guardrails = { ...existingGuardrails, ...(dto.guardrails ?? {}) };
    this.validatePreset(weights, guardrails);

    const latest = await this.prisma.recommendationTuningPreset.findFirst({
      where: { presetKey: existing.presetKey },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? existing.version) + 1;
    const created = await this.prisma.$transaction(async (tx) => {
      if (existing.status === 'draft') {
        await tx.recommendationTuningPreset.update({
          where: { id: existing.id },
          data: { status: 'archived', archivedAt: new Date() },
        });
      }
      const nextPreset = await tx.recommendationTuningPreset.create({
        data: {
          presetKey: existing.presetKey,
          name: dto.name?.trim() || existing.name,
          description:
            dto.description === undefined
              ? existing.description
              : dto.description.trim() || null,
          status: 'draft',
          version: nextVersion,
          weights: this.toJson(weights),
          guardrails: this.toJson(guardrails),
          createdByAdminId: actorAdminId,
        },
      });
      await this.writeAudit(
        nextPreset.id,
        'updated',
        actorAdminId,
        existing,
        nextPreset,
        tx,
      );
      return nextPreset;
    });
    return this.mapPreset(created);
  }

  async activatePreset(id: string, actorAdminId: string) {
    this.assertPresetManagementEnabled();
    const preset = await this.getPresetRecord(id);
    if (preset.status === 'archived') {
      throw new BadRequestException(
        'Archived tuning presets cannot be activated directly.',
      );
    }
    const previousActive =
      await this.prisma.recommendationTuningPreset.findFirst({
        where: { status: 'active' },
      });
    const activated = await this.prisma.$transaction(async (tx) => {
      if (previousActive && previousActive.id !== preset.id) {
        await tx.recommendationTuningPreset.update({
          where: { id: previousActive.id },
          data: { status: 'archived', archivedAt: new Date() },
        });
      }
      const nextPreset = await tx.recommendationTuningPreset.update({
        where: { id: preset.id },
        data: {
          status: 'active',
          activatedAt: new Date(),
          archivedAt: null,
        },
      });
      await this.writeAudit(
        nextPreset.id,
        'activated',
        actorAdminId,
        previousActive,
        nextPreset,
        tx,
      );
      return nextPreset;
    });
    return this.mapPreset(activated);
  }

  async rollbackPreset(
    id: string,
    targetVersion: number | undefined,
    actorAdminId: string,
  ) {
    this.assertPresetManagementEnabled();
    const current = await this.getPresetRecord(id);
    if (current.status !== 'active') {
      throw new BadRequestException(
        'Only the active tuning preset can be rolled back.',
      );
    }
    const target = await this.prisma.recommendationTuningPreset.findFirst({
      where: {
        presetKey: current.presetKey,
        version:
          targetVersion === undefined ? { lt: current.version } : targetVersion,
      },
      orderBy: { version: 'desc' },
    });
    if (!target) {
      throw new BadRequestException(
        'No previous tuning preset version is available for rollback.',
      );
    }
    if (target.version >= current.version) {
      throw new BadRequestException(
        'Rollback target must be an earlier tuning preset version.',
      );
    }
    const restored = await this.prisma.$transaction(async (tx) => {
      await tx.recommendationTuningPreset.updateMany({
        where: { status: 'active' },
        data: { status: 'archived', archivedAt: new Date() },
      });
      const nextPreset = await tx.recommendationTuningPreset.update({
        where: { id: target.id },
        data: {
          status: 'active',
          activatedAt: new Date(),
          archivedAt: null,
        },
      });
      await this.writeAudit(
        nextPreset.id,
        'rolled_back',
        actorAdminId,
        current,
        nextPreset,
        tx,
      );
      return nextPreset;
    });
    return this.mapPreset(restored);
  }

  async archivePreset(id: string, actorAdminId: string) {
    this.assertPresetManagementEnabled();
    const preset = await this.getPresetRecord(id);
    if (preset.status === 'archived') {
      return this.mapPreset(preset);
    }
    const archived = await this.prisma.$transaction(async (tx) => {
      const nextPreset = await tx.recommendationTuningPreset.update({
        where: { id },
        data: { status: 'archived', archivedAt: new Date() },
      });
      await this.writeAudit(
        nextPreset.id,
        'archived',
        actorAdminId,
        preset,
        nextPreset,
        tx,
      );
      return nextPreset;
    });
    return this.mapPreset(archived);
  }

  async getPreviewConfig(id: string) {
    this.assertWorkflowEnabled();
    return this.toConfig(await this.getPresetRecord(id));
  }

  async recordPreview(id: string, actorAdminId: string, nextValue: unknown) {
    await this.writeAudit(id, 'previewed', actorAdminId, null, nextValue);
  }

  async getActiveRuntimeConfig(): Promise<RecommendationTuningConfig | null> {
    const flags = this.getWorkflowFlags();
    if (
      !flags.workflowEnabled ||
      !flags.presetsEnabled ||
      !flags.activePresetEnabled
    ) {
      return null;
    }
    const preset = await this.prisma.recommendationTuningPreset.findFirst({
      where: { status: 'active' },
      orderBy: { activatedAt: 'desc' },
    });
    return preset ? this.toConfig(preset) : null;
  }

  private assertPresetManagementEnabled() {
    this.assertWorkflowEnabled();
    if (!this.readFlag(RECOMMENDATION_TUNING_PRESETS_FLAG)) {
      throw new NotFoundException();
    }
  }

  private async getPresetRecord(id: string) {
    const preset = await this.prisma.recommendationTuningPreset.findUnique({
      where: { id },
    });
    if (!preset) {
      throw new NotFoundException(`Tuning preset ${id} was not found.`);
    }
    return preset;
  }

  private validatePreset(
    weights: RecommendationTuningWeights,
    guardrails: RecommendationTuningGuardrails,
  ) {
    for (const key of RECOMMENDATION_TUNING_CORE_WEIGHT_KEYS) {
      if (
        !Number.isFinite(weights[key]) ||
        weights[key] < RECOMMENDATION_TUNING_LIMITS.coreWeightMin ||
        weights[key] > RECOMMENDATION_TUNING_LIMITS.coreWeightMax
      ) {
        throw new BadRequestException(
          `${key} must stay between ${RECOMMENDATION_TUNING_LIMITS.coreWeightMin} and ${RECOMMENDATION_TUNING_LIMITS.coreWeightMax}.`,
        );
      }
    }
    for (const key of [
      'personalizationScore',
      'analyticsPerformanceScore',
    ] as const) {
      if (
        !Number.isFinite(weights[key]) ||
        weights[key] < RECOMMENDATION_TUNING_LIMITS.optionalWeightMin ||
        weights[key] > RECOMMENDATION_TUNING_LIMITS.optionalWeightMax
      ) {
        throw new BadRequestException(
          `${key} must stay between ${RECOMMENDATION_TUNING_LIMITS.optionalWeightMin} and ${RECOMMENDATION_TUNING_LIMITS.optionalWeightMax}.`,
        );
      }
    }
    const coreWeightSum = RECOMMENDATION_TUNING_CORE_WEIGHT_KEYS.reduce(
      (sum, key) => sum + weights[key],
      0,
    );
    if (
      coreWeightSum < RECOMMENDATION_TUNING_LIMITS.coreWeightSumMin ||
      coreWeightSum > RECOMMENDATION_TUNING_LIMITS.coreWeightSumMax
    ) {
      throw new BadRequestException(
        `Core ranking weight sum must stay between ${RECOMMENDATION_TUNING_LIMITS.coreWeightSumMin} and ${RECOMMENDATION_TUNING_LIMITS.coreWeightSumMax}.`,
      );
    }
    if (
      !Number.isFinite(weights.sponsoredBoost) ||
      weights.sponsoredBoost <
        RECOMMENDATION_TUNING_LIMITS.sponsoredWeightMin ||
      weights.sponsoredBoost > RECOMMENDATION_TUNING_LIMITS.sponsoredWeightMax
    ) {
      throw new BadRequestException(
        'Sponsored boost multiplier cannot exceed the existing organic-relevance guardrail.',
      );
    }
    if (
      Object.values(guardrails).some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    ) {
      throw new BadRequestException(
        'Preset guardrails must be finite non-negative numbers.',
      );
    }
    if (
      guardrails.maxSponsoredBoostScore >
        RECOMMENDATION_TUNING_LIMITS.maxSponsoredBoostScore ||
      guardrails.maxBusinessBoostScore >
        RECOMMENDATION_TUNING_LIMITS.maxBusinessBoostScore ||
      guardrails.maxAnalyticsPerformanceScore >
        RECOMMENDATION_TUNING_LIMITS.maxAnalyticsPerformanceScore ||
      guardrails.maxPersonalizationScore >
        RECOMMENDATION_TUNING_LIMITS.maxPersonalizationScore
    ) {
      throw new BadRequestException(
        'Preset guardrails cannot exceed platform safety limits.',
      );
    }
  }

  private toConfig(
    preset: RecommendationTuningPreset,
  ): RecommendationTuningConfig {
    const weights = this.readWeights(preset.weights);
    const guardrails = this.readGuardrails(preset.guardrails);
    this.validatePreset(weights, guardrails);
    return {
      presetId: preset.id,
      presetKey: preset.presetKey,
      version: preset.version,
      weights,
      guardrails,
    };
  }

  private readWeights(value: Prisma.JsonValue): RecommendationTuningWeights {
    return {
      ...DEFAULT_RECOMMENDATION_TUNING_WEIGHTS,
      ...(this.readJsonObject(value) as Partial<RecommendationTuningWeights>),
    };
  }

  private readGuardrails(
    value: Prisma.JsonValue,
  ): RecommendationTuningGuardrails {
    return {
      ...DEFAULT_RECOMMENDATION_TUNING_GUARDRAILS,
      ...(this.readJsonObject(
        value,
      ) as Partial<RecommendationTuningGuardrails>),
    };
  }

  private readJsonObject(value: Prisma.JsonValue) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  }

  private mapPreset(preset: RecommendationTuningPreset) {
    return {
      id: preset.id,
      presetKey: preset.presetKey,
      name: preset.name,
      description: preset.description,
      status: preset.status,
      version: preset.version,
      weights: this.readWeights(preset.weights),
      guardrails: this.readGuardrails(preset.guardrails),
      createdByAdminId: preset.createdByAdminId,
      activatedAt: preset.activatedAt?.toISOString() ?? null,
      archivedAt: preset.archivedAt?.toISOString() ?? null,
      createdAt: preset.createdAt.toISOString(),
      updatedAt: preset.updatedAt.toISOString(),
    };
  }

  private async writeAudit(
    presetId: string,
    action: string,
    actorAdminId: string,
    previousValue: unknown,
    nextValue: unknown,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    await client.recommendationTuningAuditLog.create({
      data: {
        presetId,
        action,
        actorAdminId,
        previousValue: this.toNullableJson(previousValue),
        nextValue: this.toNullableJson(nextValue),
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private toNullableJson(value: unknown) {
    return value === null || value === undefined
      ? Prisma.JsonNull
      : this.toJson(value);
  }

  private readFlag(name: string) {
    const raw = this.configService.get<string>(name);
    if (raw === undefined) {
      return false;
    }
    return !['0', 'false', 'off', 'no'].includes(raw.toLowerCase());
  }
}
