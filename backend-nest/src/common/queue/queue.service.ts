import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly configService: ConfigService) {}

  async enqueue<TData extends Record<string, unknown>>(
    queueName: string,
    jobName: string,
    data: TData,
  ): Promise<{ jobId: string; queued: boolean }> {
    const isDisabled =
      this.configService.get<string>('BULLMQ_DISABLED', 'true') === 'true';

    if (isDisabled) {
      return {
        jobId: `simulated-${Date.now()}`,
        queued: false,
      };
    }

    const queue = this.getOrCreateQueue(queueName);
    const job = await queue.add(jobName, data);

    return {
      jobId: job.id?.toString() ?? `job-${Date.now()}`,
      queued: true,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(this.queues.values()).map(async (queue) => {
        try {
          await queue.close();
        } catch (error) {
          this.logger.warn(`Failed to close queue cleanly: ${String(error)}`);
        }
      }),
    );
  }

  private getOrCreateQueue(name: string): Queue {
    const existing = this.queues.get(name);
    if (existing) {
      return existing;
    }

    const queue = new Queue(name, {
      connection: {
        host: this.configService.get<string>('REDIS_HOST', '127.0.0.1'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
        db: this.configService.get<number>('REDIS_DB', 0),
        lazyConnect: true,
      },
    });

    this.queues.set(name, queue);
    return queue;
  }
}
