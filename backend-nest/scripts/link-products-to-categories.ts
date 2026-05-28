import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CategoriesService } from '../src/modules/categories/categories.service';

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const categoriesService = app.get(CategoriesService);
    const result =
      await categoriesService.linkProductsToExistingCategoriesFromNames({
        dryRun,
      });

    console.log(
      JSON.stringify(
        {
          event: 'categories_link_products_completed',
          ...result,
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
      event: 'categories_link_products_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  process.exitCode = 1;
});
