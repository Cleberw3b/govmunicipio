import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { SpecialtyEntity } from '../../entities';

const databaseUrl = process.env.DATABASE_URL;

const AppDataSource = new DataSource(
  databaseUrl
    ? {
        type: 'postgres',
        url: databaseUrl,
        ssl: { rejectUnauthorized: false },
        entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
        synchronize: false,
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
        synchronize: false,
        logging: false,
      },
);

async function seedSpecialties(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Connected to database.');

  const specialtyRepo = AppDataSource.getRepository(SpecialtyEntity);

  const sigtapPath = path.join(__dirname, 'sigtap-procedures.json');
  const sigtapData: Array<{ code: string; name: string; groupCode: string; groupName: string }> =
    JSON.parse(fs.readFileSync(sigtapPath, 'utf-8'));

  const BATCH_SIZE = 500;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < sigtapData.length; i += BATCH_SIZE) {
    const batch = sigtapData.slice(i, i + BATCH_SIZE);
    const result = await specialtyRepo
      .createQueryBuilder()
      .insert()
      .into(SpecialtyEntity)
      .values(
        batch.map((p) => ({
          code: p.code,
          name: p.name,
          groupCode: p.groupCode,
          groupName: p.groupName,
          price: 0,
          isActive: true,
        })),
      )
      .orIgnore()
      .execute();
    inserted += result.identifiers.length;
    skipped += batch.length - result.identifiers.length;
    process.stdout.write(`\r  Processed ${Math.min(i + BATCH_SIZE, sigtapData.length)}/${sigtapData.length}`);
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} already existed.`);
  await AppDataSource.destroy();
}

seedSpecialties().catch((err) => {
  console.error(err);
  process.exit(1);
});
