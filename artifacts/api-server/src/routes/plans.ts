import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, projectsTable, nodesTable, movePlansTable, auditEntriesTable } from "@workspace/db";
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

type ValidationIssue = { kind: string; severity: string; message: string; nodeId: string | null };
type MoveChange = { nodeId: string; nodeName: string; kind: string; fromPath: string; toPath: string };

function serializePlan(p: typeof movePlansTable.$inferSelect) {
  return {
    id: p.id,
    projectId: p.projectId,
    description: p.description ?? null,
    status: p.status,
    nodeId: p.nodeId,
    targetPath: p.targetPath,
    changes: (p.changes as MoveChange[]) ?? [],
    validationIssues: (p.validationIssues as ValidationIssue[]) ?? [],
    canApply: p.canApply,
    createdAt: p.createdAt.toISOString(),
    appliedAt: p.appliedAt?.toISOString() ?? null,
  };
}

/** Compute the projected changes for moving a node to a new path */
function computeChanges(node: typeof nodesTable.$inferSelect, targetPath: string): MoveChange[] {
  const changes: MoveChange[] = [
    {
      nodeId: node.id,
      nodeName: node.name,
      kind: node.kind,
      fromPath: node.physicalPath,
      toPath: targetPath,
    },
  ];
  return changes;
}

/** Validate a planned move */
function validateMove(
  node: typeof nodesTable.$inferSelect,
  targetPath: string,
  allNodes: typeof nodesTable.$inferSelect[],
  rootPath: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Root escape check
  if (!targetPath.startsWith(rootPath)) {
    issues.push({ kind: "root_escape", severity: "error", message: `Target path "${targetPath}" escapes project root "${rootPath}"`, nodeId: node.id });
  }

  // Not movable
  if (!node.movable) {
    issues.push({ kind: "reserved_name", severity: "error", message: `Node "${node.name}" is marked as non-movable`, nodeId: node.id });
  }

  // Path collision check
  const collision = allNodes.find((n) => n.id !== node.id && n.physicalPath === targetPath);
  if (collision) {
    issues.push({ kind: "duplicate_path", severity: "error", message: `Path "${targetPath}" is already occupied by "${collision.name}"`, nodeId: node.id });
  }

  // Reserved names check
  const targetName = targetPath.split("/").pop() ?? "";
  const reserved = [".git", "node_modules", "__pycache__", ".DS_Store"];
  if (reserved.includes(targetName)) {
    issues.push({ kind: "reserved_name", severity: "warning", message: `Target name "${targetName}" is reserved`, nodeId: node.id });
  }

  // Moving into itself (folder only)
  if (node.kind === "folder" && targetPath.startsWith(node.physicalPath + "/")) {
    issues.push({ kind: "circular_ref", severity: "error", message: `Cannot move folder "${node.name}" into itself`, nodeId: node.id });
  }

  // Path traversal check
  if (targetPath.includes("..")) {
    issues.push({ kind: "root_escape", severity: "error", message: `Target path contains path traversal sequence`, nodeId: node.id });
  }

  return issues;
}

// GET /projects/:projectId/plans
router.get("/", async (req, res) => {
  const projectId = parseInt((req.params as any).projectId);
  const plans = await db
    .select()
    .from(movePlansTable)
    .where(eq(movePlansTable.projectId, projectId))
    .orderBy(sql`${movePlansTable.createdAt} DESC`);
  return res.json(plans.map(serializePlan));
});

// POST /projects/:projectId/plans — dry-run
router.post("/", async (req, res) => {
  const projectId = parseInt((req.params as any).projectId);
  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, projectId) });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { nodeId, targetPath, description } = req.body as {
    nodeId: string;
    targetPath: string;
    description?: string;
  };

  if (!nodeId?.trim() || !targetPath?.trim()) {
    return res.status(400).json({ error: "nodeId and targetPath are required" });
  }

  const node = await db.query.nodesTable.findFirst({
    where: and(eq(nodesTable.id, nodeId), eq(nodesTable.projectId, projectId)),
  });
  if (!node) return res.status(400).json({ error: `Node "${nodeId}" not found in this project` });

  const allNodes = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  const issues = validateMove(node, targetPath.trim(), allNodes, project.rootPath);
  const changes = computeChanges(node, targetPath.trim());
  const canApply = !issues.some((i) => i.severity === "error");

  const [plan] = await db
    .insert(movePlansTable)
    .values({
      projectId,
      description: description?.trim() || null,
      status: "pending",
      nodeId,
      targetPath: targetPath.trim(),
      changes,
      validationIssues: issues,
      canApply,
    })
    .returning();

  return res.status(201).json(serializePlan(plan));
});

// GET /projects/:projectId/plans/:planId
router.get("/:planId", async (req, res) => {
  const projectId = parseInt((req.params as any).projectId);
  const planId = parseInt(req.params.planId);
  const plan = await db.query.movePlansTable.findFirst({
    where: and(eq(movePlansTable.id, planId), eq(movePlansTable.projectId, projectId)),
  });
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  return res.json(serializePlan(plan));
});

// POST /projects/:projectId/plans/:planId/apply
router.post("/:planId/apply", async (req, res) => {
  const projectId = parseInt((req.params as any).projectId);
  const planId = parseInt(req.params.planId);

  const plan = await db.query.movePlansTable.findFirst({
    where: and(eq(movePlansTable.id, planId), eq(movePlansTable.projectId, projectId)),
  });
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  if (plan.status !== "pending") return res.status(400).json({ error: `Plan is already ${plan.status}` });
  if (!plan.canApply) return res.status(400).json({ error: "Plan has validation errors and cannot be applied" });

  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, projectId) });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const snapshotBefore = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  const node = await db.query.nodesTable.findFirst({ where: eq(nodesTable.id, plan.nodeId) });
  if (!node) return res.status(400).json({ error: "Target node no longer exists" });

  // Re-validate at apply time
  const allNodes = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  const freshIssues = validateMove(node, plan.targetPath, allNodes, project.rootPath);
  const freshCanApply = !freshIssues.some((i) => i.severity === "error");

  if (!freshCanApply) {
    await db.update(movePlansTable).set({ status: "failed", validationIssues: freshIssues, canApply: false }).where(eq(movePlansTable.id, planId));
    return res.status(400).json({ error: "Plan failed re-validation at apply time" });
  }

  // Apply: update physicalPath, logicalPath, name, depth, and parentId
  const newName = plan.targetPath.split("/").pop() ?? node.name;
  // Compute path relative to project root (strip leading rootPath/)
  const rootPrefix = project.rootPath.endsWith("/") ? project.rootPath : project.rootPath + "/";
  const relPhysPath = plan.targetPath.startsWith(rootPrefix)
    ? plan.targetPath.slice(rootPrefix.length)
    : plan.targetPath;
  const newDepth = relPhysPath.split("/").length - 1;

  // Derive new logicalPath: keep same structure as relPhysPath
  const newLogicalPath = relPhysPath;

  // Find new parentId: look for a node whose physicalPath equals the parent directory
  const parentPhysDir = plan.targetPath.substring(0, plan.targetPath.lastIndexOf("/"));
  const newParentNode = allNodes.find(
    (n) => n.id !== node.id && n.physicalPath === parentPhysDir
  );
  const newParentId = newParentNode?.id ?? null;

  await db.update(nodesTable)
    .set({
      physicalPath: plan.targetPath,
      logicalPath: newLogicalPath,
      name: newName,
      depth: newDepth,
      parentId: newParentId,
    })
    .where(eq(nodesTable.id, plan.nodeId));
  const now = new Date();
  await db.update(movePlansTable).set({ status: "applied", appliedAt: now }).where(eq(movePlansTable.id, planId));

  const snapshotAfter = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  const changeId = randomUUID();

  const [auditEntry] = await db.insert(auditEntriesTable).values({
    projectId,
    changeId,
    operation: "move",
    planId,
    status: "success",
    summary: `Moved "${node.name}" from ${node.physicalPath} → ${plan.targetPath}`,
    snapshotBefore: snapshotBefore.map(serializeNode),
    snapshotAfter: snapshotAfter.map(serializeNode),
    canRestore: true,
  }).returning();

  const updatedPlan = await db.query.movePlansTable.findFirst({ where: eq(movePlansTable.id, planId) });

  return res.json({
    plan: serializePlan(updatedPlan!),
    auditEntry: {
      id: auditEntry.id,
      projectId: auditEntry.projectId,
      changeId: auditEntry.changeId,
      operation: auditEntry.operation,
      planId: auditEntry.planId ?? null,
      status: auditEntry.status,
      summary: auditEntry.summary,
      snapshotBefore: auditEntry.snapshotBefore,
      snapshotAfter: auditEntry.snapshotAfter,
      canRestore: auditEntry.canRestore,
      createdAt: auditEntry.createdAt.toISOString(),
    },
    nodesUpdated: 1,
  });
});

export default router;
