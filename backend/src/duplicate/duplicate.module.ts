import { Module } from '@nestjs/common';
import { DuplicateService } from './duplicate.service';

@Module({
  providers: [DuplicateService],
  exports: [DuplicateService],
})
export class DuplicateModule {}
