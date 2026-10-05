import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_workshops_level" AS ENUM('beginner', 'intermediate');
  CREATE TYPE "public"."enum_workshops_day" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TYPE "public"."enum_clinics_day" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"intro" varchar,
  	"body" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "topics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "workshops" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"level" "enum_workshops_level" NOT NULL,
  	"day" "enum_workshops_day" NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar,
  	"price" numeric NOT NULL,
  	"group_size" numeric DEFAULT 6 NOT NULL,
  	"summary" varchar NOT NULL,
  	"description" jsonb,
  	"image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "workshops_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"topics_id" integer
  );
  
  CREATE TABLE "clinics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"day" "enum_clinics_day" NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL,
  	"summary" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "time_slots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"places" numeric DEFAULT 2 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"time_slot_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "repairs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "throttle" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "name" varchar;
  ALTER TABLE "media" ADD COLUMN "prefix" varchar DEFAULT '';
  ALTER TABLE "media" ADD COLUMN "_objectkey" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "topics_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "workshops_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinics_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "time_slots_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "repairs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "throttle_id" integer;
  ALTER TABLE "workshops" ADD CONSTRAINT "workshops_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workshops_rels" ADD CONSTRAINT "workshops_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workshops_rels" ADD CONSTRAINT "workshops_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE restrict ON UPDATE no action;
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE UNIQUE INDEX "topics_slug_idx" ON "topics" USING btree ("slug");
  CREATE INDEX "topics_updated_at_idx" ON "topics" USING btree ("updated_at");
  CREATE INDEX "topics_created_at_idx" ON "topics" USING btree ("created_at");
  CREATE UNIQUE INDEX "workshops_slug_idx" ON "workshops" USING btree ("slug");
  CREATE INDEX "workshops_image_idx" ON "workshops" USING btree ("image_id");
  CREATE INDEX "workshops_updated_at_idx" ON "workshops" USING btree ("updated_at");
  CREATE INDEX "workshops_created_at_idx" ON "workshops" USING btree ("created_at");
  CREATE INDEX "workshops_rels_order_idx" ON "workshops_rels" USING btree ("order");
  CREATE INDEX "workshops_rels_parent_idx" ON "workshops_rels" USING btree ("parent_id");
  CREATE INDEX "workshops_rels_path_idx" ON "workshops_rels" USING btree ("path");
  CREATE INDEX "workshops_rels_topics_id_idx" ON "workshops_rels" USING btree ("topics_id");
  CREATE UNIQUE INDEX "clinics_slug_idx" ON "clinics" USING btree ("slug");
  CREATE INDEX "clinics_updated_at_idx" ON "clinics" USING btree ("updated_at");
  CREATE INDEX "clinics_created_at_idx" ON "clinics" USING btree ("created_at");
  CREATE INDEX "time_slots_clinic_idx" ON "time_slots" USING btree ("clinic_id");
  CREATE INDEX "time_slots_updated_at_idx" ON "time_slots" USING btree ("updated_at");
  CREATE INDEX "time_slots_created_at_idx" ON "time_slots" USING btree ("created_at");
  CREATE INDEX "bookings_time_slot_idx" ON "bookings" USING btree ("time_slot_id");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX "repairs_updated_at_idx" ON "repairs" USING btree ("updated_at");
  CREATE INDEX "repairs_created_at_idx" ON "repairs" USING btree ("created_at");
  CREATE INDEX "throttle_key_idx" ON "throttle" USING btree ("key");
  CREATE INDEX "throttle_updated_at_idx" ON "throttle" USING btree ("updated_at");
  CREATE INDEX "throttle_created_at_idx" ON "throttle" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_workshops_fk" FOREIGN KEY ("workshops_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinics_fk" FOREIGN KEY ("clinics_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_time_slots_fk" FOREIGN KEY ("time_slots_id") REFERENCES "public"."time_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_repairs_fk" FOREIGN KEY ("repairs_id") REFERENCES "public"."repairs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_throttle_fk" FOREIGN KEY ("throttle_id") REFERENCES "public"."throttle"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("topics_id");
  CREATE INDEX "payload_locked_documents_rels_workshops_id_idx" ON "payload_locked_documents_rels" USING btree ("workshops_id");
  CREATE INDEX "payload_locked_documents_rels_clinics_id_idx" ON "payload_locked_documents_rels" USING btree ("clinics_id");
  CREATE INDEX "payload_locked_documents_rels_time_slots_id_idx" ON "payload_locked_documents_rels" USING btree ("time_slots_id");
  CREATE INDEX "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX "payload_locked_documents_rels_repairs_id_idx" ON "payload_locked_documents_rels" USING btree ("repairs_id");
  CREATE INDEX "payload_locked_documents_rels_throttle_id_idx" ON "payload_locked_documents_rels" USING btree ("throttle_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "workshops" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "workshops_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "clinics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "time_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bookings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "repairs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "throttle" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "topics" CASCADE;
  DROP TABLE "workshops" CASCADE;
  DROP TABLE "workshops_rels" CASCADE;
  DROP TABLE "clinics" CASCADE;
  DROP TABLE "time_slots" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "repairs" CASCADE;
  DROP TABLE "throttle" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_pages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_topics_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_workshops_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinics_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_time_slots_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bookings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_repairs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_throttle_fk";
  
  DROP INDEX "payload_locked_documents_rels_pages_id_idx";
  DROP INDEX "payload_locked_documents_rels_topics_id_idx";
  DROP INDEX "payload_locked_documents_rels_workshops_id_idx";
  DROP INDEX "payload_locked_documents_rels_clinics_id_idx";
  DROP INDEX "payload_locked_documents_rels_time_slots_id_idx";
  DROP INDEX "payload_locked_documents_rels_bookings_id_idx";
  DROP INDEX "payload_locked_documents_rels_repairs_id_idx";
  DROP INDEX "payload_locked_documents_rels_throttle_id_idx";
  ALTER TABLE "users" DROP COLUMN "name";
  ALTER TABLE "media" DROP COLUMN "prefix";
  ALTER TABLE "media" DROP COLUMN "_objectkey";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "topics_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "workshops_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinics_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "time_slots_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "bookings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "repairs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "throttle_id";
  DROP TYPE "public"."enum_workshops_level";
  DROP TYPE "public"."enum_workshops_day";
  DROP TYPE "public"."enum_clinics_day";`)
}
