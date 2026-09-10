import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateComplaintDto {
  @IsNotEmpty({ message: 'Complaint description is required' })
  @IsString()
  description: string;

  @IsNotEmpty({ message: 'Location name is required' })
  @IsString()
  locationName: string;

  @IsNotEmpty({ message: 'Latitude is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Latitude must be a valid number' })
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNotEmpty({ message: 'Longitude is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Longitude must be a valid number' })
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Affected people must be a number' })
  @Min(1)
  affectedPeople?: number;
}
