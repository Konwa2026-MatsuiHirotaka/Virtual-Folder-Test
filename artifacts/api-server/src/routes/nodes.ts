import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, nodesTable, projectsTable, auditEntriesTable } from "@workspace/db";
import { randomUUID } from "crypto";

const router = Router({ mergeParams: true });

function serializeNode(n: typeof nodesTable.$inferSelect) {
  return {
    id: n.id,
    projectId: n.projectId,
    kind: n.kind,
    name: n.name,
    logicalPath: n.logicalPath,
    physicalPath: n.physicalPath,
    movable: n.movable,
    parentId: n.parentId ?? null,
    depth: n.depth,
    exportNames: n.exportNames ?? [],
    createdAt: n.createdAt.toISOString(),
  };
}

// GET /projects/:projectId/nodes
router.get("/", async (req, res) => {
  const projectId = parseInt((req.params as any).projectId);
  const nodes = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  return res.json(nodes.map(serializeNode));
});

// POST /projects/:projectId/nodes
router.post("/", async (req, res) => {
  const projectId = parseInt((req.params as any).projectId);
  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, projectId) });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { id, kind, name, logicalPath, physicalPath, movable, parentId, exportNames } = req.body as {
    id?: string;
    kind: "file" | "folder";
    name: string;
    logicalPath: string;
    physicalPath: string;
    movable?: boolean;
    parentId?: string;
    exportNames?: string[];
  };

  if (!kind || !name?.trim() || !logicalPath?.trim() || !physicalPath?.trim()) {
    return res.status(400).json({ error: "kind, name, logicalPath, and physicalPath are required" });
  }

  // Calculate depth from physicalPath relative to rootPath
  const relPath = physicalPath.replace(project.rootPath + "/", "");
  const depth = relPath.split("/").length - 1;

  const nodeId = id ?? `${projectId}-${logicalPath.replace(/[^a-z0-9]/gi, "-")}-${Date.now()}`;

  const [node] = await db
    .insert(nodesTable)
    .values({
      id: nodeId,
      projectId,
      kind,
      name: name.trim(),
      logicalPath: logicalPath.trim(),
      physicalPath: physicalPath.trim(),
      movable: movable ?? true,
      parentId: parentId ?? null,
      depth,
      exportNames: exportNames ?? [],
    })
    .returning();

  // Audit log
  const snapshot = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  await db.insert(auditEntriesTable).values({
    projectId,
    changeId: randomUUID(),
    operation: "create",
    status: "success",
    summary: `Added ${kind} "${name}" at ${physicalPath}`,
    snapshotBefore: snapshot.filter((n) => n.id !== node.id).map(serializeNode),
    snapshotAfter: snapshot.map(serializeNode),
    canRestore: true,
  });

  return res.status(201).json(serializeNode(node));
});

// DELETE /projects/:projectId/nodes/:nodeId
router.delete("/:nodeId", async (req, res) => {
  const projectId = parseInt((req.params as any).projectId);
  const nodeId = req.params.nodeId;

  const existing = await db.query.nodesTable.findFirst({
    where: and(eq(nodesTable.id, nodeId), eq(nodesTable.projectId, projectId)),
  });
  if (!existing) return res.status(404).json({ error: "Node not found" });

  const snapshotBefore = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  await db.delete(nodesTable).where(and(eq(nodesTable.id, nodeId), eq(nodesTable.projectId, projectId)));
  const snapshotAfter = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));

  await db.insert(auditEntriesTable).values({
    projectId,
    changeId: randomUUID(),
    operation: "delete",
    status: "success",
    summary: `Removed ${existing.kind} "${existing.name}" from ${existing.physicalPath}`,
    snapshotBefore: snapshotBefore.map((n) => ({
      id: n.id, projectId: n.projectId, kind: n.kind, name: n.name,
      logicalPath: n.logicalPath, physicalPath: n.physicalPath, movable: n.movable,
      parentId: n.parentId ?? null, depth: n.depth, exportNames: n.exportNames ?? [],
      createdAt: n.createdAt.toISOString(),
    })),
    snapshotAfter: snapshotAfter.map((n) => ({
      id: n.id, projectId: n.projectId, kind: n.kind, name: n.name,
      logicalPath: n.logicalPath, physicalPath: n.physicalPath, movable: n.movable,
      parentId: n.parentId ?? null, depth: n.depth, exportNames: n.exportNames ?? [],
      createdAt: n.createdAt.toISOString(),
    })),
    canRestore: true,
  });

  return res.status(204).send();
});

export default router;
