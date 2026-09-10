import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('api/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('maps')
  getMapsConfig() {
    // This is intentionally a browser key. Restrict it in Google Cloud Console
    // to this application's HTTP referrers and the Maps JavaScript API.
    return {
      googleMapsApiKey: this.configService.get<string>('GOOGLE_MAPS_API_KEY') || '',
    };
  }
}
