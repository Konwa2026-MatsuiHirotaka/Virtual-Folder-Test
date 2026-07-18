import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, projectsTable, nodesTable, auditEntriesTable, movePlansTable } from "@workspace/db";
import { randomUUID } from "crypto";

const router = Router({ mergeParams: true });

type SerializedNode = {
  id: string; projectId: number; kind: string; name: string;
  logicalPath: string; physicalPath: string; movable: boolean;
  parentId: string | null; depth: number; exportNames: string[]; createdAt: string;
};

function serializeNode(n: typeof nodesTable.$inferSelect): SerializedNode {
  return {
    id: n.id, projectId: n.projectId, kind: n.kind, name: n.name,
    logicalPath: n.logicalPath, physicalPath: n.physicalPath, movable: n.movable,
    parentId: n.parentId ?? null, depth: n.depth, exportNames: n.exportNames ?? [],
    createdAt: n.createdAt.toISOString(),
  };
}

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

// POST /projects/:projectId/restore/:changeId
router.post("/:changeId", async (req, res) => {
  const projectId = parseInt((req.params as any).projectId);
  const changeId = req.params.changeId;

  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, projectId) });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const entry = await db.query.auditEntriesTable.findFirst({
    where: eq(auditEntriesTable.changeId, changeId),
  });
  if (!entry) return res.status(404).json({ error: "Audit entry not found" });
  if (!entry.canRestore) return res.status(400).json({ error: "This change cannot be restored" });
  if (entry.projectId !== projectId) return res.status(404).json({ error: "Audit entry not found in this project" });

  const snapshotBefore = entry.snapshotBefore as SerializedNode[];
  const currentNodes = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));

  // Restore: delete all current nodes and re-insert from snapshot
  await db.delete(nodesTable).where(eq(nodesTable.projectId, projectId));
  if (snapshotBefore.length > 0) {
    await db.insert(nodesTable).values(
      snapshotBefore.map((n) => ({
        id: n.id,
        projectId: n.projectId,
        kind: n.kind,
        name: n.name,
        logicalPath: n.logicalPath,
        physicalPath: n.physicalPath,
        movable: n.movable,
        parentId: n.parentId,
        depth: n.depth,
        exportNames: n.exportNames,
        createdAt: new Date(n.createdAt),
      }))
    );
  }

  await db.update(auditEntriesTable).set({ status: "rolled_back", canRestore: false }).where(eq(auditEntriesTable.id, entry.id));
  if (entry.planId) {
    await db.update(movePlansTable).set({ status: "rolled_back" }).where(eq(movePlansTable.id, entry.planId));
  }

  const restoredAfter = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  const newChangeId = randomUUID();
  const [auditEntry] = await db.insert(auditEntriesTable).values({
    projectId,
    changeId: newChangeId,
    operation: "restore",
    status: "success",
    summary: `Restored project to state before: "${entry.summary}"`,
    snapshotBefore: currentNodes.map(serializeNode),
    snapshotAfter: restoredAfter.map(serializeNode),
    canRestore: true,
  }).returning();

  return res.json({
    restoredNodes: snapshotBefore.length,
    auditEntry: serializeAudit(auditEntry),
    message: `Successfully restored to state before "${entry.summary}"`,
  });
});

export default router;
