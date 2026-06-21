import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type VisualEmbeddingResult = {
  embedding: number[];
  dimensions: number;
  model: string;
  provider: string;
  fingerprint: string;
};

@Injectable()
export class VisualEmbeddingClient {
  constructor(private readonly configService: ConfigService) {}

  embedBytes(image: Buffer) {
    return this.request({ image_base64: image.toString('base64') });
  }

  embedUrl(imageUrl: string) {
    return this.request({ image_url: imageUrl });
  }

  private async request(payload: Record<string, string>) {
    const baseUrl = this.configService
      .get<string>('AI_SERVICE_BASE_URL', 'http://127.0.0.1:8000')
      .replace(/\/$/, '');
    const token = this.configService.get<string>('AI_SERVICE_INTERNAL_TOKEN');
    const controller = new AbortController();
    const configuredTimeout = Number(
      this.configService.get<string>(
        'VISUAL_EMBEDDING_REQUEST_TIMEOUT_MS',
        '60000',
      ),
    );
    const timeout = setTimeout(
      () => controller.abort(),
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 60_000,
    );

    try {
      const response = await fetch(
        `${baseUrl}/internal/visual-search/embeddings`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Internal-Token': token } : {}),
          },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          detail?: unknown;
        } | null;
        const detail =
          typeof body?.detail === 'string' ? ` ${body.detail}` : '';
        throw new Error(
          `Visual embedding service returned ${response.status}.${detail}`,
        );
      }
      const result = (await response.json()) as VisualEmbeddingResult;
      if (
        !Array.isArray(result.embedding) ||
        result.embedding.length !== 512 ||
        result.dimensions !== 512
      ) {
        throw new Error('Visual embedding dimensions must be 512.');
      }
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
}
