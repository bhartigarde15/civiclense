import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Controller('api/complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async createComplaint(
    @Body() dto: CreateComplaintDto,
    @UploadedFile() imageFile?: Express.Multer.File,
  ) {
    return this.complaintsService.createComplaint(dto, imageFile);
  }

  @Get()
  async getComplaints(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.complaintsService.getComplaints(limit, offset);
  }

  @Get(':id/image')
  async getComplaintImage(@Param('id') id: string, @Res() response: Response) {
    const image = await this.complaintsService.getComplaintImage(id);
    response.set({
      'Content-Type': image.contentType,
      'Cache-Control': 'private, max-age=3600',
    });
    return response.send(image.data);
  }

  @Get(':id')
  async getComplaintById(@Param('id') id: string) {
    return this.complaintsService.getComplaintById(id);
  }
}
