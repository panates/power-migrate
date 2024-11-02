import { Connection } from 'postgrejs';
import { Migration, PgMigrator } from 'power-migrate';

describe('PgMigrator', () => {
  let connection: Connection;
  const noOp = async () => {};
  const allMigrations: Migration[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09'].map(id => ({
    id: String(id),
    title: 'test migration ' + id,
    up: noOp,
    dow: noOp,
  }));
  let migrationIndex = 0;

  beforeAll(async () => {
    connection = new Connection({ database: 'postgres' });
    await connection.connect();
    await connection.execute(`drop table if exists public.__migrations cascade;`);
  });

  afterAll(async () => {
    await connection.close(0);
  });

  it('should create PgMigrator', async () => {
    const migrator = await PgMigrator.create({
      connection,
      migrations: [],
    });
    expect(migrator).toBeDefined();
  });

  it('should migrate up', async () => {
    const migrations = allMigrations.slice(migrationIndex, migrationIndex + 2);
    migrationIndex += 2;
    const migrator = await PgMigrator.create({
      connection,
      migrations,
    });
    const result = await migrator.up();
    expect(result).toEqual(migrations);
  });

  it('should list migrated records', async () => {
    const migrations = allMigrations.slice(0, migrationIndex);
    const migrator = await PgMigrator.create({
      connection,
    });
    const recs = await migrator.list();
    expect(recs).toEqual(
      migrations.map(m => ({
        id: m.id,
        title: m.title,
        status: 'done',
        createdAt: expect.any(Date),
      })),
    );
  });

  it('should migrate new migrations', async () => {
    const migrations = allMigrations.slice(0, migrationIndex + 2);
    migrationIndex += 2;
    const migrator = await PgMigrator.create({
      connection,
      migrations,
    });
    const recs = await migrator.up();
    expect(recs).toEqual(allMigrations.slice(migrationIndex - 2, migrationIndex));
  });

  it('should limit migration count using "step"', async () => {
    const migrations = allMigrations.slice(0, migrationIndex + 5);
    migrationIndex += 1;
    const migrator = await PgMigrator.create({
      connection,
      migrations,
    });
    const recs = await migrator.up({ step: 1 });
    expect(recs).toEqual(allMigrations.slice(migrationIndex - 1, migrationIndex));
  });

  it('should run migrations to given id using "to" option', async () => {
    const migrations = allMigrations.slice(0, migrationIndex + 5);
    migrationIndex += 1;
    const migrator = await PgMigrator.create({
      connection,
      migrations,
    });
    const recs = await migrator.up({ to: '07' });
    const ids = recs.map(x => x.id).join();
    expect(ids.includes('8')).toBeFalsy();
    expect(ids.includes('9')).toBeFalsy();
  });

  it('should run script migrations', async () => {
    allMigrations.push({
      id: '50',
      title: 'script migration',
      script: 'select {{xx}};',
    });
    migrationIndex += 1;
    const migrator = await PgMigrator.create({
      connection,
      migrations: allMigrations,
      scriptVariables: { xx: '1' },
    });
    let script = '';
    migrator.on('migrated', args => {
      if (args.script) script = args.script;
    });
    await migrator.up();
    expect(script).toEqual('select 1;');
  });
});
