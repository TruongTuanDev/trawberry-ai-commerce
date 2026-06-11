/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AdminOnlyGuard } from '../src/common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AdminRecommendationTuningController } from '../src/modules/recommendations/admin-recommendation-tuning.controller';
import {
  DEFAULT_RECOMMENDATION_TUNING_GUARDRAILS,
  DEFAULT_RECOMMENDATION_TUNING_WEIGHTS,
} from '../src/modules/recommendations/recommendation-tuning-config';
import { RecommendationTuningService } from '../src/modules/recommendations/recommendation-tuning.service';
import { RecommendationsService } from '../src/modules/recommendations/recommendations.service';
import { readBody } from './test-helpers';

jest.setTimeout(30000);

const ADMIN_ID = '10000000-0000-0000-0000-000000000001';
const PRESET_ID_V1 = '20000000-0000-0000-0000-000000000001';
const PRESET_ID_V2 = '20000000-0000-0000-0000-000000000002';
const PRESET_KEY = '30000000-0000-0000-0000-000000000001';

type StoredPreset = {
  id: string;
  presetKey: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  weights: Record<string, number>;
  guardrails: Record<string, number>;
  createdByAdminId: string;
  activatedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('AdminRecommendationTuningController (e2e)', () => {
  let app: INestApplication<App>;
  let presets: StoredPreset[];
  let auditLogs: Array<Record<string, unknown>>;
  const originalEnv = { ...process.env };
  const recommendationsServiceMock = {
    previewTuningPreset: jest.fn(),
  };

  const prismaMock = {
    recommendationTuningPreset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    recommendationTuningAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    process.env.RECOMMENDATION_TUNING_WORKFLOW_ENABLED = 'true';
    process.env.RECOMMENDATION_TUNING_PRESETS_ENABLED = 'true';
    process.env.RECOMMENDATION_TUNING_ACTIVE_PRESET_ENABLED = 'false';
    presets = [];
    auditLogs = [];

    prismaMock.recommendationTuningPreset.findMany.mockImplementation(
      ({ where }) => {
        const rows = where?.presetKey
          ? presets.filter((preset) => preset.presetKey === where.presetKey)
          : presets;
        return Promise.resolve([...rows].sort((a, b) => b.version - a.version));
      },
    );
    prismaMock.recommendationTuningPreset.findUnique.mockImplementation(
      ({ where }) => {
        const preset = presets.find((item) => item.id === where.id) ?? null;
        return Promise.resolve(preset);
      },
    );
    prismaMock.recommendationTuningPreset.findFirst.mockImplementation(
      ({ where, orderBy }) => {
        let rows = [...presets];
        if (where?.status) {
          rows = rows.filter((preset) => preset.status === where.status);
        }
        if (where?.presetKey) {
          rows = rows.filter((preset) => preset.presetKey === where.presetKey);
        }
        if (typeof where?.version === 'number') {
          rows = rows.filter((preset) => preset.version === where.version);
        } else if (where?.version?.lt) {
          rows = rows.filter((preset) => preset.version < where.version.lt);
        }
        if (orderBy?.version === 'desc') {
          rows.sort((a, b) => b.version - a.version);
        }
        return Promise.resolve(rows[0] ?? null);
      },
    );
    prismaMock.recommendationTuningPreset.create.mockImplementation(
      ({ data }) => {
        const row: StoredPreset = {
          id: presets.length === 0 ? PRESET_ID_V1 : PRESET_ID_V2,
          presetKey: data.presetKey ?? PRESET_KEY,
          name: data.name,
          description: data.description ?? null,
          status: data.status ?? 'draft',
          version: data.version ?? 1,
          weights: data.weights,
          guardrails: data.guardrails,
          createdByAdminId: data.createdByAdminId,
          activatedAt: null,
          archivedAt: null,
          createdAt: new Date('2026-06-11T00:00:00.000Z'),
          updatedAt: new Date('2026-06-11T00:00:00.000Z'),
        };
        presets.push(row);
        return Promise.resolve(row);
      },
    );
    prismaMock.recommendationTuningPreset.update.mockImplementation(
      ({ where, data }) => {
        const preset = presets.find((item) => item.id === where.id)!;
        Object.assign(preset, data, {
          updatedAt: new Date('2026-06-11T01:00:00.000Z'),
        });
        return Promise.resolve(preset);
      },
    );
    prismaMock.recommendationTuningPreset.updateMany.mockImplementation(
      ({ where, data }) => {
        const matching = presets.filter(
          (preset) => !where?.status || preset.status === where.status,
        );
        matching.forEach((preset) => Object.assign(preset, data));
        return Promise.resolve({ count: matching.length });
      },
    );
    prismaMock.recommendationTuningAuditLog.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        const log = {
          id: `audit-${auditLogs.length + 1}`,
          createdAt: new Date('2026-06-11T00:00:00.000Z'),
          ...data,
        };
        auditLogs.push(log);
        return Promise.resolve(log);
      },
    );
    prismaMock.recommendationTuningAuditLog.findMany.mockImplementation(
      ({ where }) => {
        const familyIds = new Set(
          presets
            .filter((preset) => preset.presetKey === where?.preset?.presetKey)
            .map((preset) => preset.id),
        );
        return Promise.resolve(
          auditLogs.filter((log) => familyIds.has(String(log.presetId))),
        );
      },
    );
    prismaMock.$transaction.mockImplementation((callback) =>
      callback(prismaMock),
    );
    recommendationsServiceMock.previewTuningPreset.mockResolvedValue({
      placement: 'home',
      guardrailViolations: [],
      items: [],
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminRecommendationTuningController],
      providers: [
        RecommendationTuningService,
        AdminOnlyGuard,
        ConfigService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: RecommendationsService,
          useValue: recommendationsServiceMock,
        },
      ],
    })
      .overrideGuard(AdminJwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string | undefined>;
              user?: Record<string, string>;
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            userId: ADMIN_ID,
            sub: ADMIN_ID,
            email: 'admin@example.com',
            role: req.headers['x-test-role'] ?? 'ADMIN',
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication<App>();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('lets admins create a safe draft and blocks seller access', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/admin/recommendations/tuning-presets')
      .send(buildPresetInput())
      .expect(201);

    expect(
      readBody<{ status: string; version: number }>(created),
    ).toMatchObject({
      status: 'draft',
      version: 1,
    });
    expect(auditLogs[0]).toMatchObject({ action: 'created' });

    await request(app.getHttpServer())
      .get('/api/admin/recommendations/tuning-presets')
      .set('x-test-role', 'SELLER')
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/admin/recommendations/tuning-presets')
      .set('x-test-role', 'CUSTOMER')
      .send(buildPresetInput())
      .expect(403);
  });

  it('rejects unsafe weights and keeps sponsored multiplier bounded', async () => {
    const input = buildPresetInput();
    input.weights.sponsoredBoost = 1.2;

    await request(app.getHttpServer())
      .post('/api/admin/recommendations/tuning-presets')
      .send(input)
      .expect(400);
    expect(presets).toHaveLength(0);
  });

  it('rejects incomplete presets and keeps drafts out of runtime ranking', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/recommendations/tuning-presets')
      .send({ name: 'Incomplete preset' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/admin/recommendations/tuning-presets')
      .send(buildPresetInput())
      .expect(201);
    process.env.RECOMMENDATION_TUNING_ACTIVE_PRESET_ENABLED = 'true';

    expect(
      await app.get(RecommendationTuningService).getActiveRuntimeConfig(),
    ).toBeNull();
  });

  it('versions updates and rolls an active preset back to a prior version', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/recommendations/tuning-presets')
      .send(buildPresetInput())
      .expect(201);
    const updated = await request(app.getHttpServer())
      .patch(`/api/admin/recommendations/tuning-presets/${PRESET_ID_V1}`)
      .send({
        description: 'Version two',
        weights: { freshnessScore: 1.2 },
      })
      .expect(200);
    expect(
      readBody<{ version: number; weights: { freshnessScore: number } }>(
        updated,
      ),
    ).toMatchObject({
      version: 2,
      weights: { freshnessScore: 1.2 },
    });

    await request(app.getHttpServer())
      .post(
        `/api/admin/recommendations/tuning-presets/${PRESET_ID_V2}/activate`,
      )
      .expect(201);
    const rolledBack = await request(app.getHttpServer())
      .post(
        `/api/admin/recommendations/tuning-presets/${PRESET_ID_V2}/rollback`,
      )
      .send({ targetVersion: 1 })
      .expect(201);

    expect(readBody<{ id: string; status: string }>(rolledBack)).toMatchObject({
      id: PRESET_ID_V1,
      status: 'active',
    });
    expect(auditLogs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        'created',
        'updated',
        'activated',
        'rolled_back',
      ]),
    );
    const detail = await request(app.getHttpServer())
      .get(`/api/admin/recommendations/tuning-presets/${PRESET_ID_V1}`)
      .expect(200);
    expect(
      readBody<{ auditLogs: Array<{ action: string }> }>(detail).auditLogs.map(
        (log) => log.action,
      ),
    ).toEqual(
      expect.arrayContaining([
        'created',
        'updated',
        'activated',
        'rolled_back',
      ]),
    );
  });

  it('rejects rollback targets that are not older than the selected version', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/recommendations/tuning-presets')
      .send(buildPresetInput())
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/admin/recommendations/tuning-presets/${PRESET_ID_V1}`)
      .send({ description: 'Version two' })
      .expect(200);
    await request(app.getHttpServer())
      .post(
        `/api/admin/recommendations/tuning-presets/${PRESET_ID_V2}/activate`,
      )
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/admin/recommendations/tuning-presets/${PRESET_ID_V2}/rollback`,
      )
      .send({ targetVersion: 2 })
      .expect(400);
  });

  it('routes preview through the side-effect-free recommendation preview path', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/recommendations/tuning-presets')
      .send(buildPresetInput())
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/recommendations/tuning-presets/${PRESET_ID_V1}/preview`)
      .send({ placement: 'home', limit: 8 })
      .expect(201);

    expect(recommendationsServiceMock.previewTuningPreset).toHaveBeenCalledWith(
      PRESET_ID_V1,
      expect.objectContaining({ placement: 'home', limit: 8 }),
      expect.anything(),
      expect.objectContaining({ role: 'ADMIN' }),
    );
  });
});

function buildPresetInput() {
  return {
    name: 'Balanced controlled tuning',
    description: 'Safe draft',
    weights: { ...DEFAULT_RECOMMENDATION_TUNING_WEIGHTS },
    guardrails: { ...DEFAULT_RECOMMENDATION_TUNING_GUARDRAILS },
  };
}
