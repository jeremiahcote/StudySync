import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const assignments = sqliteTable(
  "assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id"),
    title: text("title").notNull(),
    course: text("course").notNull(),
    dueAt: text("due_at").notNull(),
    priority: text("priority", {
      enum: ["low", "medium", "high"],
    })
      .notNull()
      .default("medium"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(60),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    canvasAssignmentId: text("canvas_assignment_id"),
    canvasCourseId: text("canvas_course_id"),
  },
  (table) => [
    index("idx_assignments_user_completed_due_at").on(
      table.userId,
      table.completed,
      table.dueAt,
    ),
    uniqueIndex("idx_assignments_user_canvas_assignment").on(
      table.userId,
      table.canvasAssignmentId,
    ),
  ],
);

export const canvasConnections = sqliteTable(
  "canvas_connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    baseUrl: text("base_url").notNull(),
    canvasUserId: text("canvas_user_id").notNull(),
    canvasUserName: text("canvas_user_name"),
    tokenCiphertext: text("token_ciphertext").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_canvas_connections_user_id").on(table.userId)],
);

export const reminderPreferences = sqliteTable("reminder_preferences", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  emailEnabled: integer("email_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  emailTiming: text("email_timing", {
    enum: ["morning", "day-before", "both"],
  })
    .notNull()
    .default("morning"),
  timezone: text("timezone").notNull().default("UTC"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const reminderSends = sqliteTable(
  "reminder_sends",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    assignmentId: integer("assignment_id").notNull(),
    reminderType: text("reminder_type", {
      enum: ["morning", "day-before"],
    }).notNull(),
    reminderDate: text("reminder_date").notNull(),
    sentAt: text("sent_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_reminder_sends_assignment_window").on(
      table.userId,
      table.assignmentId,
      table.reminderType,
      table.reminderDate,
    ),
  ],
);

export type Assignment = typeof assignments.$inferSelect;
export type CanvasConnection = typeof canvasConnections.$inferSelect;
export type ReminderPreference = typeof reminderPreferences.$inferSelect;
export type ReminderSend = typeof reminderSends.$inferSelect;
