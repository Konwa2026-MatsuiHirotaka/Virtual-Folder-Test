import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, auditEntriesTable } from "@workspace/db";

const router = Router({ mergeParams: true });

type SerializedNode = {
  id: string; projectId: number; kind: string; name: string;
  logicalPath: string; physicalPath: string; movable: boolean;
  parentId: string | null; depth: number; exportNames: string[]; createdAt: string;
};

function serializeAudit(e: typeof auditEntriesTable.$inferSelect) {
  return {
    id: e.id,
    projectId: e.projectId,
    changeId: e.changeId,
    operation: e.operation,
    planId: e.planId ?? null,
    status: e.status,
    summary: e.summary,
    snapshotBefore: e.snapshotBefore as SerializedNode[],
    snapshotAfter: e.snapshotAfter as SerializedNode[],
    canRestore: e.canRestore,
    createdAt: e.createdAt.toISOString(),
  };
}

// GET /projects/:projectId/audit
router.get("/", async (req, res) => {
  const projectId = parseInt((req.params as any).projectId);
  const entries = await db
    .select()
    .from(auditEntriesTable)
    .where(eq(auditEntriesTable.projectId, projectId))
    .orderBy(sql`${auditEntriesTable.createdAt} DESC`);
  return res.json(entries.map(serializeAudit));
});

export default router;
