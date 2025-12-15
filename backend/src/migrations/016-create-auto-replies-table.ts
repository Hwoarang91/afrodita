import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAutoRepliesTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'auto_replies',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'keyword',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'response',
            type: 'text',
          },
          {
            name: 'match_type',
            type: 'varchar',
            length: '50',
            default: "'exact'",
          },
          {
            name: 'case_sensitive',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'chat_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'chat_id',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'usage_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'last_used_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'auto_replies',
      new TableIndex({
        name: 'IDX_auto_replies_keyword_is_active',
        columnNames: ['keyword', 'is_active'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('auto_replies');
  }
}

