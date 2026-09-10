import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { BigQueryModule } from './bigquery/bigquery.module';
import { StorageModule } from './storage/storage.module';
import { AiModule } from './ai/ai.module';
import { PriorityModule } from './priority/priority.module';
import { DuplicateModule } from './duplicate/duplicate.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    HealthModule,
    BigQueryModule,
    StorageModule,
    AiModule,
    PriorityModule,
    DuplicateModule,
    ComplaintsModule,
    DashboardModule,
    AuthModule,
  ],
})
export class AppModule {}
