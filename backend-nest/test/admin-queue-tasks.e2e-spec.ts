/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AdminQueueTasksController } from '../src/modules/admin/admin-queue-tasks.controller';
import { AdminQueueTasksService } from '../src/modules/admin/admin-queue-tasks.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { readBody } from './test-helpers';

describe('AdminQueueTasksController (e2e)', () => {
  let app: INestApplication<App>;
  let tasks: Array<Record<string, unknown>>;
  let events: Array<Record<string, unknown>>;
  const users = [
    {
      id: 'admin-1',
      email: 'admin@example.com',
      fullName: 'Admin One',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      id: 'admin-2',
      email: 'admin2@example.com',
      fullName: 'Admin Two',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      id: 'seller-1',
      email: 'seller@example.com',
      fullName: 'Seller One',
      role: 'SELLER',
      status: 'ACTIVE',
    },
  ];

  const includeAssignee = (task: Record<string, unknown>) => ({
    ...task,
    assignedTo: users.find((user) => user.id === task.assignedToUserId) ?? null,
  });

  const prismaMock = {
    user: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(users.find((user) => user.id === where.id) ?? null),
      ),
    },
    adminQueueTask: {
      count: jest.fn(() => Promise.resolve(tasks.length)),
      findMany: jest.fn(() => Promise.resolve(tasks.map(includeAssignee))),
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(
          tasks.find(
            (task) =>
              task.id === where.id ||
              (where.entityType_entityId &&
                task.entityType === where.entityType_entityId.entityType &&
                task.entityId === where.entityType_entityId.entityId),
          ) ?? null,
        ),
      ),
      findUniqueOrThrow: jest.fn(({ where }) =>
        Promise.resolve(
          includeAssignee(tasks.find((task) => task.id === where.id)!),
        ),
      ),
      create: jest.fn(({ data }) => {
        const task = {
          id: `00000000-0000-4000-8000-${String(tasks.length + 1).padStart(12, '0')}`,
          status: 'OPEN',
          priority: 'NORMAL',
          slaStatus: 'OK',
          createdAt: new Date(),
          updatedAt: new Date(),
          assignedAt: null,
          resolvedAt: null,
          escalatedAt: null,
          assignedToUserId: null,
          lastNote: null,
          ...data,
        };
        tasks.push(task);
        return Promise.resolve(task);
      }),
      update: jest.fn(({ where, data }) => {
        const index = tasks.findIndex((task) => task.id === where.id);
        tasks[index] = { ...tasks[index], ...data, updatedAt: new Date() };
        return Promise.resolve(tasks[index]);
      }),
    },
    adminQueueTaskEvent: {
      create: jest.fn(({ data }) => {
        const event = {
          id: `event-${events.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        events.push(event);
        return Promise.resolve(event);
      }),
      findMany: jest.fn(({ where }) =>
        Promise.resolve(
          events
            .filter((event) => event.taskId === where.taskId)
            .map((event) => ({
              ...event,
              actor: users.find((user) => user.id === event.actorUserId),
            })),
        ),
      ),
    },
    adminAuditLog: { create: jest.fn(() => Promise.resolve({})) },
    $transaction: jest.fn((callback) => callback(prismaMock)),
  };

  beforeEach(async () => {
    tasks = [];
    events = [];
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminQueueTasksController],
      providers: [
        AdminQueueTasksService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              user?: { userId: string; email: string; role: string };
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            userId: req.headers['x-test-user-id'] ?? 'admin-1',
            email: 'admin@example.com',
            role: req.headers['x-test-role'] ?? 'ADMIN',
          };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  async function createTask() {
    const response = await request(app.getHttpServer())
      .post('/api/admin/queue-tasks')
      .send({
        entityType: 'SELLER',
        entityId: 'seller-1',
        title: 'Pending seller',
        slaStatus: 'BREACHED',
      })
      .expect(201);
    return readBody<{ id: string }>(response);
  }

  it('admin can create and claim task', async () => {
    const task = await createTask();
    const response = await request(app.getHttpServer())
      .post(`/api/admin/queue-tasks/${task.id}/assign`)
      .send({ assignedToUserId: 'me' })
      .expect(201);
    const body = readBody<{ assignedToUserId: string; status: string }>(
      response,
    );
    expect(body.assignedToUserId).toBe('admin-1');
    expect(body.status).toBe('IN_PROGRESS');
    expect(events.map((event) => event.action)).toEqual([
      'CREATED',
      'ASSIGNED',
    ]);
  });

  it('admin can assign to another admin and cannot assign to non-admin', async () => {
    const task = await createTask();
    await request(app.getHttpServer())
      .post(`/api/admin/queue-tasks/${task.id}/assign`)
      .send({ assignedToUserId: 'admin-2' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/queue-tasks/${task.id}/assign`)
      .send({ assignedToUserId: 'seller-1' })
      .expect(400);
  });

  it('non-admin cannot assign', async () => {
    const task = await createTask();
    await request(app.getHttpServer())
      .post(`/api/admin/queue-tasks/${task.id}/assign`)
      .set('x-test-role', 'SELLER')
      .send({ assignedToUserId: 'me' })
      .expect(403);
  });

  it('admin can update, escalate, resolve, and list events', async () => {
    const task = await createTask();
    await request(app.getHttpServer())
      .post(`/api/admin/queue-tasks/${task.id}/status`)
      .send({ status: 'IN_PROGRESS', note: 'Working' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/queue-tasks/${task.id}/escalate`)
      .send({ priority: 'URGENT', note: 'Breached' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/queue-tasks/${task.id}/status`)
      .send({ status: 'RESOLVED', note: 'Done' })
      .expect(201);
    const eventsResponse = await request(app.getHttpServer())
      .get(`/api/admin/queue-tasks/${task.id}/events`)
      .expect(200);
    expect(
      readBody<Array<{ action: string }>>(eventsResponse).map(
        (event) => event.action,
      ),
    ).toEqual(['CREATED', 'STATUS_CHANGED', 'ESCALATED', 'STATUS_CHANGED']);
  });

  it('resolved tasks can be filtered', async () => {
    const task = await createTask();
    await request(app.getHttpServer())
      .post(`/api/admin/queue-tasks/${task.id}/status`)
      .send({ status: 'RESOLVED' })
      .expect(201);
    const response = await request(app.getHttpServer())
      .get('/api/admin/queue-tasks?status=RESOLVED')
      .expect(200);
    expect(
      readBody<{ items: Array<{ status: string }> }>(response).items[0].status,
    ).toBe('RESOLVED');
  });
});
