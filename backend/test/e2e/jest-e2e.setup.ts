import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DatabaseConfig } from '../../src/config/database.config';
import { ConfigModule, ConfigService } from '@nestjs/config';

let app: INestApplication;
let dataSource: DataSource;

export async function setupTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ['.env.test', '.env'],
      }),
      AppModule,
    ],
  })
    .overrideProvider(DatabaseConfig)
    .useFactory({
      factory: (configService: ConfigService) => {
        return {
          createTypeOrmOptions: () => ({
            type: 'postgres',
            host: configService.get('TEST_DB_HOST', 'localhost'),
            port: parseInt(configService.get('TEST_DB_PORT', '5432')),
            username: configService.get('TEST_DB_USER', 'postgres'),
            password: configService.get('TEST_DB_PASSWORD', 'postgres'),
            database: configService.get('TEST_DB_NAME', 'afrodita_test'),
            entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
            migrations: [__dirname + '/../../src/migrations/*{.ts,.js}'],
            synchronize: true, // Для тестов используем синхронизацию
            logging: false,
            dropSchema: false, // Не удаляем схему, используем synchronize
          }),
        };
      },
      inject: [ConfigService],
    })
    .compile();

  app = moduleRef.createNestApplication();
  
  // Применяем те же middleware что и в production
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/v1', {
    exclude: ['/health'],
  });

  await app.init();

  // Получаем DataSource для очистки БД
  dataSource = app.get(DataSource);
  
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (dataSource && dataSource.isInitialized) {
    // Очищаем все таблицы вместо dropDatabase
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      try {
        const repository = dataSource.getRepository(entity.name);
        await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
      } catch (error) {
        // Игнорируем ошибки если таблица не существует
      }
    }
    await dataSource.destroy();
  }
  if (app) {
    await app.close();
  }
}

export function getApp(): INestApplication {
  return app;
}

export function getRequest(): request.SuperTest<request.Test> {
  return request(app.getHttpServer());
}

