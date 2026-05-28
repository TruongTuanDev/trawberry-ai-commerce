import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CategoriesService } from '../src/modules/categories/categories.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const categoriesService = app.get(CategoriesService);
    const result = await categoriesService.syncProductsFromLegacyCategoryNames();
    console.log(
      JSON.stringify(
        {
          event: 'categories_sync_completed',
          scannedProducts: result.scannedProducts,
          createdCategories: result.createdCategories,
          linkedProducts: result.linkedProducts,
          updatedMirrors: result.updatedMirrors,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      event: 'categories_sync_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  process.exitCode = 1;
});
