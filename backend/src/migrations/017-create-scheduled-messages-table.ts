import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateScheduledMessagesTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'scheduled_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'chat_id',
            type: 'bigint',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'media_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'caption',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'poll_options',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'scheduled_at',
            type: 'timestamp',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sent_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'is_recurring',
            type: 'boolean',
            default: false,
          },
          {
            name: 'recurring_pattern',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'recurring_config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'recurring_end_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'sent_count',
            type: 'integer',
            default: 0,
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
      'scheduled_messages',
      new TableIndex({
        name: 'IDX_scheduled_messages_scheduled_at_status',
        columnNames: ['scheduled_at', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'scheduled_messages',
      new TableIndex({
        name: 'IDX_scheduled_messages_chat_id_status',
        columnNames: ['chat_id', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('scheduled_messages');
  }
}

