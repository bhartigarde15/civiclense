import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('categories')
  async getCategories() {
    return this.dashboardService.getCategories();
  }

  @Get('severity')
  async getSeverity() {
    return this.dashboardService.getSeverity();
  }

  @Get('departments')
  async getDepartments() {
    return this.dashboardService.getDepartmentWorkload();
  }

  @Get('trends')
  async getTrends() {
    return this.dashboardService.getTrends();
  }

  @Get('hotspots')
  async getHotspots(
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
  ) {
    return this.dashboardService.getHotspots(limit);
  }
}
