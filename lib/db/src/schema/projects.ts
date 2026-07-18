import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  rootPath: text("root_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

// ----- Nodes -----
export const nodesTable = pgTable("nodes", {
  id: text("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "file" | "folder"
  name: text("name").notNull(),
  logicalPath: text("logical_path").notNull(),
  physicalPath: text("physical_path").notNull(),
  movable: boolean("movable").default(true).notNull(),
  parentId: text("parent_id"),
  depth: integer("depth").default(0).notNull(),
  exportNames: text("export_names").array().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNodeSchema = createInsertSchema(nodesTable).omit({ createdAt: true });
export type InsertNode = z.infer<typeof insertNodeSchema>;
export type Node = typeof nodesTable.$inferSelect;

// ----- Move Plans -----
export const movePlansTable = pgTable("move_plans", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending | applied | failed | rolled_back
  nodeId: text("node_id").notNull(),
  targetPath: text("target_path").notNull(),
  changes: jsonb("changes").notNull().$type<object[]>().default([]),
  validationIssues: jsonb("validation_issues").notNull().$type<object[]>().default([]),
  canApply: boolean("can_apply").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  appliedAt: timestamp("applied_at"),
});

export const insertMovePlanSchema = createInsertSchema(movePlansTable).omit({ id: true, createdAt: true });
export type InsertMovePlan = z.infer<typeof insertMovePlanSchema>;
export type MovePlan = typeof movePlansTable.$inferSelect;

// ----- Audit Entries -----
export const auditEntriesTable = pgTable("audit_entries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  changeId: text("change_id").notNull(),
  operation: text("operation").notNull(), // move | restore | create | delete
  planId: integer("plan_id"),
  status: text("status").notNull(), // success | failed | rolled_back
  summary: text("summary").notNull(),
  snapshotBefore: jsonb("snapshot_before").notNull().$type<object[]>().default([]),
  snapshotAfter: jsonb("snapshot_after").notNull().$type<object[]>().default([]),
  canRestore: boolean("can_restore").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditEntrySchema = createInsertSchema(auditEntriesTable).omit({ id: true, createdAt: true });
export type InsertAuditEntry = z.infer<typeof insertAuditEntrySchema>;
export type AuditEntry = typeof auditEntriesTable.$inferSelect;
