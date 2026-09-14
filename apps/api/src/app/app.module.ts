import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActivityModule } from '../modules/activity/activity.module';
import { AuthModule } from '../modules/auth/auth.module';
import { BalancesModule } from '../modules/balances/balances.module';
import { ExportModule } from '../modules/export/export.module';
import { StaticModule } from '../static.module';
import { CategoriesModule } from '../modules/categories/categories.module';
import { ExpensesModule } from '../modules/expenses/expenses.module';
import { GroupsModule } from '../modules/groups/groups.module';
import { HealthModule } from '../modules/health/health.module';
import { MembersModule } from '../modules/members/members.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { ReceiptsModule } from '../modules/receipts/receipts.module';
import { validateEnv } from '../config/env.validation';
import { databaseSsl } from '../config/database-ssl';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/api/.env',
      // Fail at startup on missing or invalid env vars rather than on the first request.
      validate: validateEnv,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST'),
        port: Number(config.get<string>('DATABASE_PORT')),
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME'),
        ssl: databaseSsl(config.get<string>('DATABASE_SSL')),
        autoLoadEntities: true,
        synchronize: false, // Schema changes go through migrations; sync can silently drop columns
        logging: ['error', 'warn'] as ('error' | 'warn')[],
      }),
    }),

    ActivityModule,
    HealthModule,
    AuthModule,
    GroupsModule,
    MembersModule,
    CategoriesModule,
    ExpensesModule,
    PaymentsModule,
    ReceiptsModule,
    BalancesModule,
    ExportModule,
    StaticModule,
  ],
  providers: [
    // Every route requires a token unless marked @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Validate DTOs at the boundary so services only receive clean input
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // strip properties not declared on the DTO
        forbidNonWhitelisted: false,
        transform: true, // coerce e.g. "5" to 5 based on DTO types
        transformOptions: { enableImplicitConversion: true },
      }),
    },

    // Every error leaves the API as { statusCode, error, message, details? }
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
