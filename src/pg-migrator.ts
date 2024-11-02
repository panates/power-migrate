import { Connection } from 'postgrejs';
import type { Migration, MigrationDirection } from './interfaces/migration.interface.js';
import type { MigrationRecord } from './interfaces/migration-record.interface.js';
import { Migrator } from './migrator.js';

export namespace PgMigrator {
  export interface Config<TContext = any> extends Migrator.Config<TContext> {
    connection: Connection;
    infoSchema?: string;
    migrationsTable?: string;
    eventsTable?: string;
  }
}

export class PgMigrator<TContext = any> extends Migrator<TContext> {
  protected _status?: 'initializing' | 'ready';
  readonly infoSchema: string;
  readonly migrationsTable: string;
  declare readonly connection: Connection;

  static async create<TContext>(config: PgMigrator.Config<TContext>): Promise<PgMigrator<TContext>> {
    const migrator = new PgMigrator<TContext>(config);
    if (config.migrations?.length) await migrator._loadMigrations(config.migrations);
    return migrator;
  }

  protected constructor(config: PgMigrator.Config) {
    super(config);
    this.connection = config.connection;
    this.infoSchema = config.infoSchema || 'public';
    this.migrationsTable = config.migrationsTable || '__migrations';
  }

  async list(options?: Migrator.ListOptions): Promise<MigrationRecord[]> {
    await this._init();
    let sql = `select * from ${this.infoSchema}.${this.migrationsTable}`;
    const params: any[] = [];
    if (options?.filter) {
      let filter = '';
      if (options.filter.ids) {
        params.push(options.filter.ids);
        filter += `id=ANY($${params.length})`;
      }
      if (filter) {
        sql += `\nwhere ${filter}`;
      }
    }
    if (options?.limit || options?.skip) {
      sql += '\nlimit ' + (options.limit ? options.limit : 'ALL');
      if (options.skip) sql += '\noffset ' + options.skip;
    }
    sql += '\norder by id';
    const qr = await this.connection.query(sql, {
      objectRows: true,
      fetchCount: 100000,
      params,
    });
    return qr.rows!.map(
      x =>
        ({
          id: x.id,
          title: x.title == null ? undefined : x.title,
          status: x.status,
          details: x.details == null ? undefined : x.details,
          createdAt: x.created_at,
        }) satisfies MigrationRecord,
    );
  }

  protected override async _init() {
    if (this._status) return;
    this._status = 'initializing';

    /** Create migration schema */
    await this.connection.execute(`CREATE SCHEMA IF NOT EXISTS ${this.infoSchema} AUTHORIZATION postgres;`);

    /** Create migrations table if not exists */
    await this.connection.execute(`
CREATE TABLE IF NOT EXISTS ${this.infoSchema}.${this.migrationsTable}
(
    id varchar not null,
    title varchar,
    status varchar(16) not null,
    details varchar,
    created_at timestamp without time zone not null default current_timestamp,  
    CONSTRAINT pk_${this.migrationsTable} PRIMARY KEY (id)
)`);
  }

  protected async _runScript(script: string) {
    await this.connection.execute(script, { autoCommit: true });
  }

  protected async _afterMigrate(args: {
    direction: MigrationDirection;
    migration: Migration;
    script?: string;
  }): Promise<void> {
    const { migration } = args;
    await this.connection.query(`delete from ${this.infoSchema}.${this.migrationsTable} where id=$1`, {
      params: [migration.id],
    });
    await this.connection.query(
      `insert into ${this.infoSchema}.${this.migrationsTable} (id, title, status) values($1,$2,$3)`,
      {
        params: [migration.id, migration.title, 'done'],
      },
    );
    await super._afterMigrate(args);
  }

  protected async _migrateError(
    error: any,
    args: {
      direction: MigrationDirection;
      migration: Migration;
      script?: string;
    },
  ): Promise<void> {
    const { migration } = args;
    await this.connection.query(`delete from ${this.infoSchema}.${this.migrationsTable} where id=$1`, {
      params: [migration.id],
    });
    await this.connection.query(
      `insert into ${this.infoSchema}.${this.migrationsTable} (id, title, status, details) values($1,$2,$3)`,
      {
        params: [migration.id, migration.title, 'error', error.message],
      },
    );
    await super._migrateError(error, args);
  }
}
