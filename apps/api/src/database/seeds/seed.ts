import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
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
  DoctorEntity,
  PrincipalEntity,
} from '../../entities';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'govmunicipio',
  entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
  synchronize: false,
  logging: true,
});

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
      { code: 'approved', label: 'Aprovado', sortOrder: 3, isActive: true },
      { code: 'rejected', label: 'Rejeitado', sortOrder: 4, isActive: true },
      { code: 'scheduled', label: 'Agendado', sortOrder: 5, isActive: true },
      { code: 'completed', label: 'Concluido', sortOrder: 6, isActive: true },
      { code: 'cancelled', label: 'Cancelado', sortOrder: 7, isActive: true },
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

    const superAdmin = roleRepo.create({
      name: 'super_admin',
      description: 'Super administrador com todas as permissoes',
    });
    superAdmin.permissions = permissions;
    await roleRepo.save(superAdmin);

    const adminMunicipality = roleRepo.create({
      name: 'admin_municipality',
      description: 'Administrador municipal com todas as permissoes',
    });
    adminMunicipality.permissions = permissions;
    await roleRepo.save(adminMunicipality);

    const operatorTfd = roleRepo.create({
      name: 'operator_tfd',
      description: 'Operador do modulo TFD',
    });
    operatorTfd.permissions = [
      findPerm('tfd_request', 'create'),
      findPerm('tfd_request', 'read'),
      findPerm('tfd_request', 'update'),
      findPerm('person', 'create'),
      findPerm('person', 'read'),
    ];
    await roleRepo.save(operatorTfd);

    const viewer = roleRepo.create({
      name: 'viewer',
      description: 'Visualizador somente leitura',
    });
    viewer.permissions = [
      findPerm('tfd_request', 'read'),
      findPerm('person', 'read'),
    ];
    await roleRepo.save(viewer);

    console.log('Seeded 4 roles.');

    // -------------------------------------------------------
    // 6. Specialties
    // -------------------------------------------------------
    const specialtyRepo = queryRunner.manager.getRepository(SpecialtyEntity);
    const specialtyNames = [
      'Cardiologia',
      'Oncologia',
      'Neurologia',
      'Ortopedia',
      'Oftalmologia',
      'Urologia',
      'Pediatria',
      'Ginecologia',
    ];
    const specialties = await specialtyRepo.save(
      specialtyRepo.create(
        specialtyNames.map((name) => ({ name, isActive: true })),
      ),
    );
    console.log(`Seeded ${specialties.length} specialties.`);

    const findSpecialty = (name: string): SpecialtyEntity => {
      const spec = specialties.find((s) => s.name === name);
      if (!spec) throw new Error(`Specialty ${name} not found.`);
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

    const municipalityOrg = await orgRepo.save(
      orgRepo.create({
        name: 'Prefeitura Municipal de Camacari',
        cnpj: '14.109.763/0001-80',
        isActive: true,
        address: municipalityAddress,
      }),
    );

    const hospitalOrg = await orgRepo.save(
      orgRepo.create({
        name: 'Hospital Geral Roberto Santos',
        cnpj: '13.937.131/0012-41',
        isActive: true,
        address: hospitalAddress,
      }),
    );
    console.log('Seeded 2 organizations.');

    // -------------------------------------------------------
    // 9. Contacts for organizations
    // -------------------------------------------------------
    const contactRepo = queryRunner.manager.getRepository(ContactEntity);

    const municipalityContact = await contactRepo.save(
      contactRepo.create({
        type: ContactType.PHONE,
        value: '(71) 3621-9000',
        label: 'Central',
        isPrimary: true,
      }),
    );
    municipalityOrg.contacts = [municipalityContact];
    await orgRepo.save(municipalityOrg);

    const hospitalContact = await contactRepo.save(
      contactRepo.create({
        type: ContactType.PHONE,
        value: '(71) 3117-1000',
        label: 'Central',
        isPrimary: true,
      }),
    );
    hospitalOrg.contacts = [hospitalContact];
    await orgRepo.save(hospitalOrg);
    console.log('Seeded 2 organization contacts.');

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
    const hospital = hospitalRepo.create({
      cnesCode: '0005622',
      organization: hospitalOrg,
    });
    hospital.specialties = [
      findSpecialty('Cardiologia'),
      findSpecialty('Neurologia'),
      findSpecialty('Oncologia'),
      findSpecialty('Ortopedia'),
    ];
    await hospitalRepo.save(hospital);
    console.log(`Seeded hospital: ${hospital.cnesCode}`);

    // -------------------------------------------------------
    // 12. Persons
    // -------------------------------------------------------
    const personRepo = queryRunner.manager.getRepository(PersonEntity);
    const identificationRepo = queryRunner.manager.getRepository(
      PersonIdentificationEntity,
    );

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

    // 12b. Doctor person
    const doctorPerson = await personRepo.save(
      personRepo.create({
        firstName: 'Dr. Carlos',
        lastName: 'Mendes',
        gender: Gender.MALE,
      }),
    );
    await identificationRepo.save(
      identificationRepo.create({
        cpf: '111.111.111-11',
        dateOfBirth: '1975-05-15' as unknown as Date,
        person: doctorPerson,
      }),
    );
    const doctorContact = await contactRepo.save(
      contactRepo.create({
        type: ContactType.PHONE,
        value: '(71) 99999-0001',
        isPrimary: true,
      }),
    );
    doctorPerson.contacts = [doctorContact];
    await personRepo.save(doctorPerson);

    // 12c. Patient person
    const patientPerson = await personRepo.save(
      personRepo.create({
        firstName: 'Maria',
        lastName: 'Silva Santos',
        gender: Gender.FEMALE,
        address: patientAddress,
      }),
    );
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
    patientPerson.contacts = [patientContact];
    await personRepo.save(patientPerson);

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
    companionPerson.contacts = [companionContact];
    await personRepo.save(companionPerson);

    console.log('Seeded 4 persons with identifications and contacts.');

    // -------------------------------------------------------
    // 13. Doctor
    // -------------------------------------------------------
    const doctorRepo = queryRunner.manager.getRepository(DoctorEntity);
    const doctor = doctorRepo.create({
      crm: '12345-BA',
      isActive: true,
      person: doctorPerson,
    });
    doctor.specialties = [findSpecialty('Cardiologia')];
    await doctorRepo.save(doctor);
    console.log(`Seeded doctor: ${doctor.crm}`);

    // -------------------------------------------------------
    // 14. Principal (admin user)
    // -------------------------------------------------------
    const principalRepo = queryRunner.manager.getRepository(PrincipalEntity);
    const passwordHash = await bcrypt.hash('admin123', 10);
    const adminPrincipal = principalRepo.create({
      username: 'admin',
      passwordHash,
      isActive: true,
      person: adminPerson,
      organization: municipalityOrg,
    });
    adminPrincipal.roles = [adminMunicipality];
    adminPrincipal.organizations = [municipalityOrg];
    await principalRepo.save(adminPrincipal);
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
    superadminPrincipal.roles = [superAdmin];
    superadminPrincipal.organizations = [];
    await principalRepo.save(superadminPrincipal);
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
