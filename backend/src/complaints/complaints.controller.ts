import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Headers,
  Patch,
  UnauthorizedException,
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
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { AuthService } from '../auth/auth.service';

@Controller('api/complaints')
export class ComplaintsController {
  constructor(
    private readonly complaintsService: ComplaintsService,
    private readonly authService: AuthService,
  ) {}

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

  @Patch(':id/status')
  async updateComplaintStatus(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintStatusDto,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!this.authService.verifyToken(token || '')) {
      throw new UnauthorizedException('A municipal officer session is required to update complaint status.');
    }
    return this.complaintsService.updateComplaintStatus(id, dto);
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
