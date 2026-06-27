'use strict';

const TABLE_NAMES = [
  'workspaces', 'users', 'workspace_members', 'projects', 'websites',
  'feedback', 'activity_logs', 'comments', 'notifications', 'api_keys',
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Enable UUID extension
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    // ─── Workspaces ───
    await queryInterface.createTable('workspaces', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      logo_url: { type: Sequelize.TEXT },
      theme: { type: Sequelize.JSONB, defaultValue: {} },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ─── Users ───
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255) },
      avatar_url: { type: Sequelize.TEXT },
      password_hash: { type: Sequelize.STRING(255) },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ─── Workspace Members ───
    await queryInterface.sequelize.query(`
      CREATE TYPE member_role AS ENUM ('owner', 'admin', 'developer', 'viewer', 'client');
    `);
    await queryInterface.createTable('workspace_members', {
      workspace_id: { type: Sequelize.UUID, references: { model: 'workspaces', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
      role: { type: Sequelize.ENUM('owner', 'admin', 'developer', 'viewer', 'client'), defaultValue: 'viewer', allowNull: false },
      joined_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ─── Projects ───
    await queryInterface.createTable('projects', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      workspace_id: { type: Sequelize.UUID, references: { model: 'workspaces', key: 'id' }, onDelete: 'CASCADE', allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT },
      color: { type: Sequelize.STRING(7), defaultValue: '#3B82F6' },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ─── Websites ───
    await queryInterface.createTable('websites', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      project_id: { type: Sequelize.UUID, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE', allowNull: false },
      url: { type: Sequelize.TEXT, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      widget_config: { type: Sequelize.JSONB, defaultValue: { position: 'bottom-right', color: '#3B82F6', buttonText: 'Feedback', icon: 'chat', darkMode: true } },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ─── Feedback ───
    await queryInterface.sequelize.query(`
      CREATE TYPE feedback_status AS ENUM ('new', 'open', 'in_progress', 'testing', 'done', 'closed');
      CREATE TYPE feedback_priority AS ENUM ('critical', 'high', 'medium', 'low');
    `);
    await queryInterface.createTable('feedback', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      website_id: { type: Sequelize.UUID, references: { model: 'websites', key: 'id' }, onDelete: 'CASCADE', allowNull: false },
      title: { type: Sequelize.STRING(500) },
      comment: { type: Sequelize.TEXT, allowNull: false },
      page_url: { type: Sequelize.TEXT, allowNull: false },
      coordinates: { type: Sequelize.JSONB, allowNull: false },
      screenshot: { type: Sequelize.JSONB },
      metadata: { type: Sequelize.JSONB, allowNull: false },
      status: { type: Sequelize.ENUM('new', 'open', 'in_progress', 'testing', 'done', 'closed'), defaultValue: 'new' },
      priority: { type: Sequelize.ENUM('critical', 'high', 'medium', 'low'), defaultValue: 'medium' },
      assignee_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      reporter_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      reporter_email: { type: Sequelize.STRING(255) },
      reporter_name: { type: Sequelize.STRING(255) },
      tags: { type: Sequelize.ARRAY(Sequelize.TEXT), defaultValue: [] },
      duplicate_of: { type: Sequelize.UUID, references: { model: 'feedback', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      resolved_at: { type: Sequelize.DATE },
    });

    // ─── Activity Logs ───
    await queryInterface.sequelize.query(`
      CREATE TYPE activity_action AS ENUM (
        'created', 'assigned', 'unassigned', 'status_changed', 'priority_changed',
        'comment_added', 'resolved', 'reopened', 'tag_added', 'tag_removed',
        'duplicate_marked', 'screenshot_updated'
      );
    `);
    await queryInterface.createTable('activity_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      feedback_id: { type: Sequelize.UUID, references: { model: 'feedback', key: 'id' }, onDelete: 'CASCADE', allowNull: false },
      actor_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      action: { type: Sequelize.ENUM('created', 'assigned', 'unassigned', 'status_changed', 'priority_changed', 'comment_added', 'resolved', 'reopened', 'tag_added', 'tag_removed', 'duplicate_marked', 'screenshot_updated'), allowNull: false },
      metadata: { type: Sequelize.JSONB, defaultValue: {} },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ─── Comments ───
    await queryInterface.createTable('comments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      feedback_id: { type: Sequelize.UUID, references: { model: 'feedback', key: 'id' }, onDelete: 'CASCADE', allowNull: false },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      body: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ─── Notifications ───
    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE', allowNull: false },
      type: { type: Sequelize.STRING(50), allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      body: { type: Sequelize.TEXT },
      link: { type: Sequelize.TEXT },
      is_read: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ─── API Keys ───
    await queryInterface.createTable('api_keys', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      workspace_id: { type: Sequelize.UUID, references: { model: 'workspaces', key: 'id' }, onDelete: 'CASCADE', allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      key_hash: { type: Sequelize.STRING(255), allowNull: false },
      last_used_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      expires_at: { type: Sequelize.DATE },
    });

    // ─── Indexes ───
    await queryInterface.addIndex('feedback', ['website_id']);
    await queryInterface.addIndex('feedback', ['status']);
    await queryInterface.addIndex('feedback', ['assignee_id']);
    await queryInterface.addIndex('feedback', ['created_at']);
    await queryInterface.addIndex('feedback', ['page_url']);
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS idx_feedback_tags ON "feedback" USING GIN (tags);');
    await queryInterface.addIndex('activity_logs', ['feedback_id']);
    await queryInterface.addIndex('activity_logs', ['created_at']);
    await queryInterface.addIndex('notifications', ['user_id', 'is_read']);
    await queryInterface.addIndex('projects', ['workspace_id']);
    await queryInterface.addIndex('websites', ['project_id']);
    await queryInterface.addIndex('comments', ['feedback_id']);
    await queryInterface.addIndex('api_keys', ['workspace_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('api_keys');
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('comments');
    await queryInterface.dropTable('activity_logs');
    await queryInterface.dropTable('feedback');
    await queryInterface.dropTable('websites');
    await queryInterface.dropTable('projects');
    await queryInterface.dropTable('workspace_members');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('workspaces');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS member_role;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS feedback_status;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS feedback_priority;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS activity_action;');
  },
};
