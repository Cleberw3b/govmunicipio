import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IJwtPayload } from '@govmunicipio/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: IJwtPayload) {
    this.logger.debug(`JWT valid: sub=${payload.sub} roles=[${payload.roles?.join(', ')}]`);
    return {
      principalId: payload.sub,
      organizationId: payload.organizationId,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
