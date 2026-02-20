import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrincipalEntity } from '../entities';
import { IJwtPayload, LoginResponseDto } from '@govmunicipio/shared';

@Injectable()
export class AuthService {
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
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!principal.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      principal.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
