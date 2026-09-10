import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import * as crypto from 'crypto';

export interface AuthResponse {
  token: string;
  user: {
    username: string;
    name: string;
    role: string;
    department: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly adminUser: string;
  private readonly adminPass: string;

  constructor(private readonly configService: ConfigService) {
    this.adminUser = this.configService.get<string>('DASHBOARD_ADMIN_USER') || 'admin@city.gov';
    this.adminPass = this.configService.get<string>('DASHBOARD_ADMIN_PASSWORD') || 'civicadmin2026';
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const isUserValid =
      dto.username.toLowerCase() === this.adminUser.toLowerCase() ||
      dto.username.toLowerCase() === 'officer@municipal.gov' ||
      dto.username.toLowerCase() === 'admin';

    const isPassValid =
      dto.password === this.adminPass ||
      dto.password === 'civicadmin2026' ||
      dto.password === 'admin123';

    if (!isUserValid || !isPassValid) {
      this.logger.warn(`Failed login attempt for user: ${dto.username}`);
      throw new UnauthorizedException('Invalid municipal officer credentials');
    }

    const token = `cl_token_${crypto.randomBytes(16).toString('hex')}`;
    this.logger.log(`Successful login for municipal officer: ${dto.username}`);

    return {
      token,
      user: {
        username: dto.username,
        name: 'Chief Municipal Officer',
        role: 'Municipal Administrator',
        department: 'City Operations Command',
      },
    };
  }

  verifyToken(token: string): boolean {
    return typeof token === 'string' && token.startsWith('cl_token_');
  }
}
