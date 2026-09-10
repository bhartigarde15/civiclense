import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateComplaintStatusDto {
  @IsNotEmpty({ message: 'Status is required' })
  @IsIn(['OPEN', 'IN_PROGRESS', 'CLOSED'], {
    message: 'Status must be OPEN, IN_PROGRESS, or CLOSED',
  })
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
}
