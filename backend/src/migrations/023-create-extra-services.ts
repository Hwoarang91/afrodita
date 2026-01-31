import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExtraServices0231707000000000 implements MigrationInterface {
  name = 'CreateExtraServices0231707000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "extra_services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "price" decimal(10,2) NOT NULL,
        "icon" character varying(64),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_extra_services" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_extra_services_isActive" ON "extra_services" ("isActive")`);

    await queryRunner.query(`
      CREATE TABLE "appointment_extra_services" (
        "appointmentId" uuid NOT NULL,
        "extraServiceId" uuid NOT NULL,
        CONSTRAINT "PK_appointment_extra_services" PRIMARY KEY ("appointmentId", "extraServiceId"),
        CONSTRAINT "FK_appointment_extra_services_appointment" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_appointment_extra_services_extra" FOREIGN KEY ("extraServiceId") REFERENCES "extra_services"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "appointment_extra_services"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "extra_services"`);
  }
}
