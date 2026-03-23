import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { ContactType, Gender } from '@govmunicipio/shared';
import {
  StatusEntity,
  ModuleEntity,
  ModuleStatusEntity,
  PermissionEntity,
  RoleEntity,
  SpecialtyEntity,
  AddressEntity,
  ContactEntity,
  OrganizationEntity,
  MunicipalityEntity,
  HospitalEntity,
  PersonEntity,
  PersonIdentificationEntity,
  PrincipalEntity,
  HospitalSpecialtyLinkEntity,
  PrincipalRoleLinkEntity,
  PrincipalOrganizationLinkEntity,
  OrganizationAddressLinkEntity,
  PersonAddressLinkEntity,
  PersonContactLinkEntity,
  OrganizationContactLinkEntity,
  RolePermissionLinkEntity,
} from '../../entities';

const databaseUrl = process.env.DATABASE_URL;

const AppDataSource = new DataSource(
  databaseUrl
    ? {
        type: 'postgres',
        url: databaseUrl,
        ssl: { rejectUnauthorized: false },
        entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
        synchronize: true,
        logging: false,
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'govmunicipio',
        entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
        synchronize: true,
        logging: false,
      },
);

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connection established.');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    // -------------------------------------------------------
    // 1. Statuses
    // -------------------------------------------------------
    const statusRepo = queryRunner.manager.getRepository(StatusEntity);
    const statusesData = [
      { code: 'draft', label: 'Rascunho', sortOrder: 1, isActive: true },
      { code: 'pending', label: 'Pendente', sortOrder: 2, isActive: true },
      { code: 'in_transit', label: 'Em Trânsito', sortOrder: 3, isActive: true },
      { code: 'finalized', label: 'Finalizado', sortOrder: 4, isActive: true },
      { code: 'cancelled', label: 'Cancelado', sortOrder: 5, isActive: true },
    ];
    const statuses = await statusRepo.save(statusRepo.create(statusesData));
    console.log(`Seeded ${statuses.length} statuses.`);

    // -------------------------------------------------------
    // 2. Module
    // -------------------------------------------------------
    const moduleRepo = queryRunner.manager.getRepository(ModuleEntity);
    const tfdModule = await moduleRepo.save(
      moduleRepo.create({
        code: 'tfd',
        name: 'Tratamento Fora do Domicilio',
        description:
          'Modulo de gestao de TFD conforme Portaria SAS n. 055/1999',
        isActive: true,
      }),
    );
    console.log(`Seeded module: ${tfdModule.code}`);

    // -------------------------------------------------------
    // 3. ModuleStatus - link all statuses to the TFD module
    // -------------------------------------------------------
    const moduleStatusRepo =
      queryRunner.manager.getRepository(ModuleStatusEntity);
    const moduleStatusesData = statuses.map((status) => ({
      module: tfdModule,
      status,
      sortOrder: status.sortOrder,
    }));
    const moduleStatuses = await moduleStatusRepo.save(
      moduleStatusRepo.create(moduleStatusesData),
    );
    console.log(`Seeded ${moduleStatuses.length} module-statuses.`);

    // -------------------------------------------------------
    // 4. Permissions
    // -------------------------------------------------------
    const permissionRepo = queryRunner.manager.getRepository(PermissionEntity);
    const permissionsData = [
      {
        resource: 'tfd_request',
        action: 'create',
        description: 'Criar solicitacao TFD',
      },
      {
        resource: 'tfd_request',
        action: 'read',
        description: 'Visualizar solicitacoes TFD',
      },
      {
        resource: 'tfd_request',
        action: 'update',
        description: 'Atualizar solicitacao TFD',
      },
      {
        resource: 'tfd_request',
        action: 'delete',
        description: 'Excluir solicitacao TFD',
      },
      {
        resource: 'person',
        action: 'create',
        description: 'Cadastrar pessoa',
      },
      {
        resource: 'person',
        action: 'read',
        description: 'Visualizar pessoa',
      },
      {
        resource: 'person',
        action: 'update',
        description: 'Atualizar pessoa',
      },
      {
        resource: 'municipality',
        action: 'create',
        description: 'Criar municipio',
      },
      {
        resource: 'municipality',
        action: 'read',
        description: 'Visualizar municipios',
      },
      {
        resource: 'principal',
        action: 'create',
        description: 'Criar principal/usuario',
      },
      {
        resource: 'principal',
        action: 'read',
        description: 'Visualizar principals/usuarios',
      },
    ];
    const permissions = await permissionRepo.save(
      permissionRepo.create(permissionsData),
    );
    console.log(`Seeded ${permissions.length} permissions.`);

    // Helper to find a permission by resource:action
    const findPerm = (resource: string, action: string): PermissionEntity => {
      const perm = permissions.find(
        (p) => p.resource === resource && p.action === action,
      );
      if (!perm)
        throw new Error(`Permission ${resource}:${action} not found.`);
      return perm;
    };

    // -------------------------------------------------------
    // 5. Roles
    // -------------------------------------------------------
    const roleRepo = queryRunner.manager.getRepository(RoleEntity);
    const rolePermissionLinkRepo = queryRunner.manager.getRepository(RolePermissionLinkEntity);

    const superAdmin = roleRepo.create({
      name: 'super_admin',
      description: 'Super administrador com todas as permissoes',
    });
    await roleRepo.save(superAdmin);
    // Link all permissions to superAdmin
    for (const perm of permissions) {
      await rolePermissionLinkRepo.save({
        roleId: superAdmin.id,
        permissionId: perm.id,
      });
    }

    const adminMunicipality = roleRepo.create({
      name: 'admin_municipality',
      description: 'Administrador municipal com todas as permissoes',
    });
    await roleRepo.save(adminMunicipality);
    // Link all permissions to adminMunicipality
    for (const perm of permissions) {
      await rolePermissionLinkRepo.save({
        roleId: adminMunicipality.id,
        permissionId: perm.id,
      });
    }

    const operatorTfd = roleRepo.create({
      name: 'operator_tfd',
      description: 'Operador do modulo TFD',
    });
    await roleRepo.save(operatorTfd);
    // Link specific permissions to operatorTfd
    const operatorPerms = [
      findPerm('tfd_request', 'create'),
      findPerm('tfd_request', 'read'),
      findPerm('tfd_request', 'update'),
      findPerm('person', 'create'),
      findPerm('person', 'read'),
    ];
    for (const perm of operatorPerms) {
      await rolePermissionLinkRepo.save({
        roleId: operatorTfd.id,
        permissionId: perm.id,
      });
    }

    const viewer = roleRepo.create({
      name: 'viewer',
      description: 'Visualizador somente leitura',
    });
    await roleRepo.save(viewer);
    // Link specific permissions to viewer
    const viewerPerms = [
      findPerm('tfd_request', 'read'),
      findPerm('person', 'read'),
    ];
    for (const perm of viewerPerms) {
      await rolePermissionLinkRepo.save({
        roleId: viewer.id,
        permissionId: perm.id,
      });
    }

    console.log('Seeded 4 roles with permission links.');

    // -------------------------------------------------------
    // 6. Specialties
    // -------------------------------------------------------
    const specialtyRepo = queryRunner.manager.getRepository(SpecialtyEntity);

    // Load SIGTAP 2025 procedures from JSON
    const sigtapPath = path.join(__dirname, 'sigtap-procedures.json');
    const sigtapData: Array<{ code: string; name: string; groupCode: string; groupName: string }> =
      JSON.parse(fs.readFileSync(sigtapPath, 'utf-8'));

    // Insert in batches of 500 to avoid memory issues
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    for (let i = 0; i < sigtapData.length; i += BATCH_SIZE) {
      const batch = sigtapData.slice(i, i + BATCH_SIZE);
      await specialtyRepo
        .createQueryBuilder()
        .insert()
        .into(SpecialtyEntity)
        .values(batch.map((p) => ({
          code: p.code,
          name: p.name,
          groupCode: p.groupCode,
          groupName: p.groupName,
          price: 0,
          isActive: true,
        })))
        .orIgnore()
        .execute();
      totalInserted += batch.length;
    }
    console.log(`Seeded ${totalInserted} SIGTAP specialties.`);

    // Pick representative procedures for hospital/doctor associations
    const allSpecialties = await specialtyRepo.find({ take: 10 });
    const findSpecialty = (code: string): SpecialtyEntity => {
      const spec = allSpecialties.find((s) => s.code === code) ?? allSpecialties[0];
      return spec;
    };

    // -------------------------------------------------------
    // 7. Addresses
    // -------------------------------------------------------
    const addressRepo = queryRunner.manager.getRepository(AddressEntity);

    const municipalityAddress = await addressRepo.save(
      addressRepo.create({
        street: 'Rua Francisco Drumond',
        number: 's/n',
        neighborhood: 'Centro',
        city: 'Camacari',
        state: 'BA',
        zipCode: '42800-000',
      }),
    );

    const hospitalAddress = await addressRepo.save(
      addressRepo.create({
        street: 'Rua Direta do Saboeiro',
        number: 's/n',
        neighborhood: 'Cabula',
        city: 'Salvador',
        state: 'BA',
        zipCode: '41180-000',
      }),
    );

    const patientAddress = await addressRepo.save(
      addressRepo.create({
        street: 'Rua das Flores',
        number: '123',
        neighborhood: 'Centro',
        city: 'Camacari',
        state: 'BA',
        zipCode: '42800-010',
      }),
    );
    console.log('Seeded 3 addresses.');

    // -------------------------------------------------------
    // 8. Organizations
    // -------------------------------------------------------
    const orgRepo = queryRunner.manager.getRepository(OrganizationEntity);
    const orgAddressLinkRepo = queryRunner.manager.getRepository(OrganizationAddressLinkEntity);

    const municipalityOrg = await orgRepo.save(
      orgRepo.create({
        name: 'Prefeitura Municipal de Camacari',
        cnpj: '14.109.763/0001-80',
        isActive: true,
      }),
    );
    // Link address to municipality organization
    await orgAddressLinkRepo.save({
      organizationId: municipalityOrg.id,
      addressId: municipalityAddress.id,
    });

    const hospitalOrg = await orgRepo.save(
      orgRepo.create({
        name: 'Hospital Geral Roberto Santos',
        cnpj: '13.937.131/0012-41',
        isActive: true,
      }),
    );
    // Link address to hospital organization
    await orgAddressLinkRepo.save({
      organizationId: hospitalOrg.id,
      addressId: hospitalAddress.id,
    });
    console.log('Seeded 2 organizations with address links.');

    // -------------------------------------------------------
    // 9. Contacts for organizations
    // -------------------------------------------------------
    const contactRepo = queryRunner.manager.getRepository(ContactEntity);
    const orgContactLinkRepo = queryRunner.manager.getRepository(OrganizationContactLinkEntity);

    const municipalityContact = await contactRepo.save(
      contactRepo.create({
        type: ContactType.PHONE,
        value: '(71) 3621-9000',
        label: 'Central',
        isPrimary: true,
      }),
    );
    // Link contact to municipality organization
    await orgContactLinkRepo.save({
      organizationId: municipalityOrg.id,
      contactId: municipalityContact.id,
    });

    const hospitalContact = await contactRepo.save(
      contactRepo.create({
        type: ContactType.PHONE,
        value: '(71) 3117-1000',
        label: 'Central',
        isPrimary: true,
      }),
    );
    // Link contact to hospital organization
    await orgContactLinkRepo.save({
      organizationId: hospitalOrg.id,
      contactId: hospitalContact.id,
    });
    console.log('Seeded 2 organization contact links.');

    // -------------------------------------------------------
    // 10. Municipality subtype
    // -------------------------------------------------------
    const municipalityRepo =
      queryRunner.manager.getRepository(MunicipalityEntity);
    const municipality = await municipalityRepo.save(
      municipalityRepo.create({
        ibgeCode: '2905701',
        state: 'BA',
        organization: municipalityOrg,
      }),
    );
    console.log(`Seeded municipality: ${municipality.ibgeCode}`);

    // -------------------------------------------------------
    // 11. Hospital subtype
    // -------------------------------------------------------
    const hospitalRepo = queryRunner.manager.getRepository(HospitalEntity);
    const hospitalSpecialtyLinkRepo = queryRunner.manager.getRepository(HospitalSpecialtyLinkEntity);

    const hospital = hospitalRepo.create({
      cnesCode: '0005622',
      organization: hospitalOrg,
    });
    await hospitalRepo.save(hospital);

    // Link specialties to hospital
    // 03.01.01.017-0 = Consulta/Avaliação em Paciente Internado
    // 03.01.06.004-1 = Consulta em Anestesiologia
    const hospitalSpecialties = allSpecialties.slice(0, 4);
    for (const specialty of hospitalSpecialties) {
      await hospitalSpecialtyLinkRepo.save({
        hospitalId: hospital.id,
        specialtyId: specialty.id,
      });
    }
    console.log(`Seeded hospital: ${hospital.cnesCode}`);

    // -------------------------------------------------------
    // 12. Persons
    // -------------------------------------------------------
    const personRepo = queryRunner.manager.getRepository(PersonEntity);
    const identificationRepo = queryRunner.manager.getRepository(
      PersonIdentificationEntity,
    );
    const personAddressLinkRepo = queryRunner.manager.getRepository(PersonAddressLinkEntity);
    const personContactLinkRepo = queryRunner.manager.getRepository(PersonContactLinkEntity);

    // 12a. Admin person
    const adminPerson = await personRepo.save(
      personRepo.create({
        firstName: 'Admin',
        lastName: 'Sistema',
        gender: Gender.NOT_INFORMED,
      }),
    );
    await identificationRepo.save(
      identificationRepo.create({
        cpf: '000.000.000-00',
        dateOfBirth: '1990-01-01' as unknown as Date,
        person: adminPerson,
      }),
    );

    // 12b. Patient person
    const patientPerson = await personRepo.save(
      personRepo.create({
        firstName: 'Maria',
        lastName: 'Silva Santos',
        gender: Gender.FEMALE,
      }),
    );
    // Link address to patient
    await personAddressLinkRepo.save({
      personId: patientPerson.id,
      addressId: patientAddress.id,
    });

    await identificationRepo.save(
      identificationRepo.create({
        cpf: '222.222.222-22',
        susCardNumber: '898 0000 0000 0001',
        dateOfBirth: '1985-08-20' as unknown as Date,
        person: patientPerson,
      }),
    );
    const patientContact = await contactRepo.save(
      contactRepo.create({
        type: ContactType.PHONE,
        value: '(71) 98888-1234',
        isPrimary: true,
      }),
    );
    // Link contact to patient
    await personContactLinkRepo.save({
      personId: patientPerson.id,
      contactId: patientContact.id,
    });

    // 12d. Companion person
    const companionPerson = await personRepo.save(
      personRepo.create({
        firstName: 'Jose',
        lastName: 'Silva',
        gender: Gender.MALE,
      }),
    );
    await identificationRepo.save(
      identificationRepo.create({
        cpf: '333.333.333-33',
        dateOfBirth: '1980-03-10' as unknown as Date,
        person: companionPerson,
      }),
    );
    const companionContact = await contactRepo.save(
      contactRepo.create({
        type: ContactType.PHONE,
        value: '(71) 97777-5678',
        isPrimary: true,
      }),
    );
    // Link contact to companion
    await personContactLinkRepo.save({
      personId: companionPerson.id,
      contactId: companionContact.id,
    });

    console.log('Seeded 4 persons with identifications, address, and contact links.');

    // -------------------------------------------------------
    // 13. Principal (admin user)
    // -------------------------------------------------------
    const principalRepo = queryRunner.manager.getRepository(PrincipalEntity);
    const principalRoleLinkRepo = queryRunner.manager.getRepository(PrincipalRoleLinkEntity);
    const principalOrganizationLinkRepo = queryRunner.manager.getRepository(PrincipalOrganizationLinkEntity);

    const passwordHash = await bcrypt.hash('admin123', 10);
    const adminPrincipal = principalRepo.create({
      username: 'admin',
      passwordHash,
      isActive: true,
      person: adminPerson,
      organization: municipalityOrg,
    });
    await principalRepo.save(adminPrincipal);

    // Link role to principal
    await principalRoleLinkRepo.save({
      principalId: adminPrincipal.id,
      roleId: adminMunicipality.id,
    });

    // Link organization to principal
    await principalOrganizationLinkRepo.save({
      principalId: adminPrincipal.id,
      organizationId: municipalityOrg.id,
    });

    console.log(`Seeded principal: ${adminPrincipal.username}`);

    // -------------------------------------------------------
    // 15. Superadmin Principal (platform-level, no organization)
    // -------------------------------------------------------
    const superadminPerson = await personRepo.save(
      personRepo.create({
        firstName: 'Super',
        lastName: 'Admin',
        gender: Gender.NOT_INFORMED,
      }),
    );
    await identificationRepo.save(
      identificationRepo.create({
        cpf: '999.999.999-99',
        dateOfBirth: '1990-01-01' as unknown as Date,
        person: superadminPerson,
      }),
    );

    const superadminPasswordHash = await bcrypt.hash('superadmin123', 10);
    const superadminPrincipal = principalRepo.create({
      username: 'superadmin',
      passwordHash: superadminPasswordHash,
      isActive: true,
      person: superadminPerson,
      organization: null,
    });
    await principalRepo.save(superadminPrincipal);

    // Link role to superadmin principal
    await principalRoleLinkRepo.save({
      principalId: superadminPrincipal.id,
      roleId: superAdmin.id,
    });

    console.log(`Seeded principal: ${superadminPrincipal.username}`);

    // -------------------------------------------------------
    // Commit transaction
    // -------------------------------------------------------
    await queryRunner.commitTransaction();
    console.log('Seed completed successfully.');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Seed failed, transaction rolled back.', error);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
    console.log('Database connection closed.');
  }
}

seed();
