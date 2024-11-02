import { MigrationStatus } from './migration.interface.js';

export interface MigrationRecord {
  id: string;
  title?: string;
  status: MigrationStatus;
  details?: string;
  createdAt?: Date;
}
