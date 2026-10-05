import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bookings" ADD COLUMN "request_id" varchar;
  CREATE UNIQUE INDEX "bookings_request_id_idx" ON "bookings" USING btree ("request_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "bookings_request_id_idx";
  ALTER TABLE "bookings" DROP COLUMN "request_id";`)
}
