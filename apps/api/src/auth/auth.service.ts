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
        roleLinks: { role: { permissionLinks: { permission: true } } },
        organizationLinks: { organization: true },
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

    this.logger.log(`Login OK: "${username}" roles=[${principal.roleLinks.map((rl) => rl.role.name).join(', ')}]`);
    return principal;
  }

  async login(
    principalId: string,
    organizationId?: string,
  ): Promise<LoginResponseDto> {
    const principal = await this.principalRepository.findOne({
      where: { id: principalId },
      relations: {
        roleLinks: { role: { permissionLinks: { permission: true } } },
        organizationLinks: { organization: true },
      },
    });

    if (!principal) {
      throw new UnauthorizedException('Principal not found');
    }

    const resolvedOrganizationId =
      organizationId ??
      (principal.organizationLinks.length > 0
        ? principal.organizationLinks[0].organization.id
        : '');

    const roles = principal.roleLinks.map((rl) => rl.role.name);

    const permissions = [
      ...new Set(
        principal.roleLinks.flatMap((rl) =>
          rl.role.permissionLinks.map((pl) => `${pl.permission.resource}:${pl.permission.action}`),
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
