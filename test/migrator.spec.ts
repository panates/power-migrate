import { Connection } from 'postgrejs';
import { Migration, PgMigrator } from 'power-migrate';

describe('Migrator', () => {
  let connection: Connection;
  const emptyUp = async () => {};

  beforeAll(async () => {
    connection = new Connection({ database: 'postgres' });
  });

  it('should create PgMigrator', async () => {
    const migrator = await PgMigrator.create({ connection, migrations: [] });
    expect(migrator).toBeDefined();
  });

  it('should init migrations', async () => {
    const migrations: Migration[] = [
      {
        id: '20241100-test1',
        title: 'Test migration',
        up: emptyUp,
      },
    ];
    const migrator = await PgMigrator.create({
      connection,
      migrations,
    });
    expect(migrator).toBeDefined();
    expect(migrator.migrations.length).toEqual(1);
    expect(migrator.migrations).toEqual(migrations);
  });

  it('should load migrations', async () => {
    const migrations: Migration[] = [
      {
        id: '20241100-test1',
        title: 'Test migration',
        up: emptyUp,
      },
      {
        id: '20241100-test2',
        title: 'Test migration',
        script: 'script',
      },
    ];
    const migrator = await PgMigrator.create({
      connection,
      migrations: [() => migrations[0], async () => migrations[1]],
    });
    expect(migrator).toBeDefined();
    expect(migrator.migrations.length).toEqual(2);
    expect(migrator.migrations).toEqual(migrations);
  });

  it('should check id is defined', async () => {
    const migrations: Migration[] = [
      {
        id: '',
        up: emptyUp,
      },
    ];
    await expect(
      PgMigrator.create({
        connection,
        migrations,
      }),
    ).rejects.toThrow('should be defined');
  });

  it('should check id is defined only once', async () => {
    const migrations: Migration[] = [
      {
        id: '1',
        up: emptyUp,
      },
      {
        id: '1',
        up: emptyUp,
      },
    ];
    await expect(
      PgMigrator.create({
        connection,
        migrations,
      }),
    ).rejects.toThrow('Duplicate');
  });

  it('should sort migrations by id', async () => {
    const migrations: Migration[] = [
      {
        id: '2',
        up: emptyUp,
      },
      {
        id: '1',
        up: emptyUp,
      },
    ];
    const migrator = await PgMigrator.create({
      connection,
      migrations,
    });
    expect(migrator).toBeDefined();
    expect(migrator.migrations).toEqual([
      {
        id: '1',
        up: emptyUp,
      },
      {
        id: '2',
        up: emptyUp,
      },
    ]);
  });
});
