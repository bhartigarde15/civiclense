import { Module } from '@nestjs/common';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';
import { StorageModule } from '../storage/storage.module';
import { AiModule } from '../ai/ai.module';
import { PriorityModule } from '../priority/priority.module';
import { DuplicateModule } from '../duplicate/duplicate.module';

@Module({
  imports: [StorageModule, AiModule, PriorityModule, DuplicateModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
