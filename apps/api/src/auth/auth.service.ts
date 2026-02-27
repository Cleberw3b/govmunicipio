import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrincipalEntity } from '../entities';
import { IJwtPayload, LoginResponseDto } from '@govmunicipio/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(PrincipalEntity)
    private readonly principalRepository: Repository<PrincipalEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async validatePrincipal(
    username: string,
    password: string,
  ): Promise<PrincipalEntity> {
    const principal = await this.principalRepository.findOne({
      where: { username },
      relations: {
        roles: { permissions: true },
        organizations: true,
      },
    });

    if (!principal) {
      this.logger.warn(`Login failed: user "${username}" not found`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!principal.isActive) {
      this.logger.warn(`Login failed: user "${username}" is inactive`);
      throw new UnauthorizedException('Account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      principal.passwordHash,
    );

    if (!isPasswordValid) {
      this.logger.warn(`Login failed: wrong password for "${username}"`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Login OK: "${username}" roles=[${principal.roles.map((r) => r.name).join(', ')}]`);
    return principal;
  }

  async login(
    principalId: string,
    organizationId?: string,
  ): Promise<LoginResponseDto> {
    const principal = await this.principalRepository.findOne({
      where: { id: principalId },
      relations: {
        roles: { permissions: true },
        organizations: true,
      },
    });

    if (!principal) {
      throw new UnauthorizedException('Principal not found');
    }

    const resolvedOrganizationId =
      organizationId ??
      (principal.organizations.length > 0
        ? principal.organizations[0].id
        : '');

    const roles = principal.roles.map((role) => role.name);

    const permissions = [
      ...new Set(
        principal.roles.flatMap((role) =>
          role.permissions.map((perm) => `${perm.resource}:${perm.action}`),
        ),
      ),
    ];

    const payload: IJwtPayload = {
      sub: principal.id,
      organizationId: resolvedOrganizationId,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);

    await this.principalRepository.update(principal.id, {
      lastLogin: new Date(),
    });

    return {
      accessToken,
      principal: {
        id: principal.id,
        username: principal.username,
        roles,
        permissions,
        organizationId: resolvedOrganizationId,
      },
    };
  }
}
