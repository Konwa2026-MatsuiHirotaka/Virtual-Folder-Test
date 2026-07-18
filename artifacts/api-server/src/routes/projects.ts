import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, projectsTable, nodesTable, movePlansTable, auditEntriesTable } from "@workspace/db";
import { randomUUID } from "crypto";

const router = Router();

// Helpers
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

async function getProjectWithCounts(id: number) {
  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, id) });
  if (!project) return null;
  const nodes = await db.select().from(nodesTable).where(eq(nodesTable.projectId, id));
  const fileCount = nodes.filter((n) => n.kind === "file").length;
  const folderCount = nodes.filter((n) => n.kind === "folder").length;
  return { project, nodes, fileCount, folderCount };
}

function serializeProject(project: typeof projectsTable.$inferSelect, fileCount: number, folderCount: number) {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    rootPath: project.rootPath,
    nodeCount: fileCount + folderCount,
    fileCount,
    folderCount,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

// Template seed data
function buildTemplateNodes(projectId: number, rootPath: string, template: string): Array<typeof nodesTable.$inferInsert> {
  const base = (kind: "file" | "folder", name: string, logicalPath: string, physPath: string, parentId: string | null, depth: number, exports: string[] = [], movable = true) => ({
    id: `${projectId}-${logicalPath.replace(/[^a-z0-9]/gi, "-")}`,
    projectId,
    kind,
    name,
    logicalPath,
    physicalPath: `${rootPath}/${physPath}`,
    movable,
    parentId,
    depth,
    exportNames: exports,
  });

  if (template === "sample-web") {
    const srcId = `${projectId}-src`;
    const compId = `${projectId}-src-components`;
    const pagesId = `${projectId}-src-pages`;
    const utilsId = `${projectId}-src-utils`;
    const stylesId = `${projectId}-src-styles`;
    return [
      base("folder", "src", "src", "src", null, 0, [], false),
      base("folder", "components", "src/components", "src/components", srcId, 1),
      base("folder", "pages", "src/pages", "src/pages", srcId, 1),
      base("folder", "utils", "src/utils", "src/utils", srcId, 1),
      base("folder", "styles", "src/styles", "src/styles", srcId, 1),
      base("file", "App.tsx", "src/App.tsx", "src/App.tsx", srcId, 1, ["App"], false),
      base("file", "index.ts", "src/index.ts", "src/index.ts", srcId, 1, ["main"], false),
      base("file", "Button.tsx", "src/components/Button.tsx", "src/components/Button.tsx", compId, 2, ["Button"]),
      base("file", "Modal.tsx", "src/components/Modal.tsx", "src/components/Modal.tsx", compId, 2, ["Modal"]),
      base("file", "Sidebar.tsx", "src/components/Sidebar.tsx", "src/components/Sidebar.tsx", compId, 2, ["Sidebar"]),
      base("file", "Home.tsx", "src/pages/Home.tsx", "src/pages/Home.tsx", pagesId, 2, ["Home"]),
      base("file", "Settings.tsx", "src/pages/Settings.tsx", "src/pages/Settings.tsx", pagesId, 2, ["Settings"]),
      base("file", "format.ts", "src/utils/format.ts", "src/utils/format.ts", utilsId, 2, ["formatDate", "formatBytes"]),
      base("file", "api.ts", "src/utils/api.ts", "src/utils/api.ts", utilsId, 2, ["fetchJson"]),
      base("file", "global.css", "src/styles/global.css", "src/styles/global.css", stylesId, 2),
      base("file", "variables.css", "src/styles/variables.css", "src/styles/variables.css", stylesId, 2),
    ];
  }

  if (template === "sample-docs") {
    const docsId = `${projectId}-docs`;
    const apiId = `${projectId}-docs-api`;
    const guidesId = `${projectId}-docs-guides`;
    return [
      base("folder", "docs", "docs", "docs", null, 0, [], false),
      base("folder", "api", "docs/api", "docs/api", docsId, 1),
      base("folder", "guides", "docs/guides", "docs/guides", docsId, 1),
      base("folder", "examples", "docs/examples", "docs/examples", docsId, 1),
      base("file", "README.md", "docs/README.md", "docs/README.md", docsId, 1),
      base("file", "overview.md", "docs/api/overview.md", "docs/api/overview.md", apiId, 2),
      base("file", "endpoints.md", "docs/api/endpoints.md", "docs/api/endpoints.md", apiId, 2),
      base("file", "auth.md", "docs/api/auth.md", "docs/api/auth.md", apiId, 2),
      base("file", "quickstart.md", "docs/guides/quickstart.md", "docs/guides/quickstart.md", guidesId, 2),
      base("file", "deployment.md", "docs/guides/deployment.md", "docs/guides/deployment.md", guidesId, 2),
    ];
  }

  if (template === "sample-data") {
    const dataId = `${projectId}-data`;
    const rawId = `${projectId}-data-raw`;
    const procId = `${projectId}-data-processed`;
    const modelsId = `${projectId}-data-models`;
    return [
      base("folder", "data", "data", "data", null, 0, [], false),
      base("folder", "raw", "data/raw", "data/raw", dataId, 1),
      base("folder", "processed", "data/processed", "data/processed", dataId, 1),
      base("folder", "models", "data/models", "data/models", dataId, 1),
      base("folder", "outputs", "data/outputs", "data/outputs", dataId, 1),
      base("file", "users.csv", "data/raw/users.csv", "data/raw/users.csv", rawId, 2),
      base("file", "events.csv", "data/raw/events.csv", "data/raw/events.csv", rawId, 2),
      base("file", "transactions.csv", "data/raw/transactions.csv", "data/raw/transactions.csv", rawId, 2),
      base("file", "users_clean.parquet", "data/processed/users_clean.parquet", "data/processed/users_clean.parquet", procId, 2),
      base("file", "events_agg.parquet", "data/processed/events_agg.parquet", "data/processed/events_agg.parquet", procId, 2),
      base("file", "churn_model.pkl", "data/models/churn_model.pkl", "data/models/churn_model.pkl", modelsId, 2),
      base("file", "revenue_forecast.pkl", "data/models/revenue_forecast.pkl", "data/models/revenue_forecast.pkl", modelsId, 2),
    ];
  }

  return [];
}

// GET /projects
router.get("/", async (req, res) => {
  const projects = await db.select().from(projectsTable);
  const results = await Promise.all(
    projects.map(async (p) => {
      const nodes = await db.select({ kind: nodesTable.kind }).from(nodesTable).where(eq(nodesTable.projectId, p.id));
      const fileCount = nodes.filter((n) => n.kind === "file").length;
      const folderCount = nodes.filter((n) => n.kind === "folder").length;
      return serializeProject(p, fileCount, folderCount);
    })
  );
  return res.json(results);
});

// POST /projects
router.post("/", async (req, res) => {
  const { name, description, rootPath, template } = req.body as {
    name: string;
    description?: string;
    rootPath: string;
    template?: string;
  };
  if (!name?.trim() || !rootPath?.trim()) {
    return res.status(400).json({ error: "name and rootPath are required" });
  }
  const [project] = await db
    .insert(projectsTable)
    .values({ name: name.trim(), description: description?.trim() || null, rootPath: rootPath.trim() })
    .returning();

  // Seed nodes from template
  const templateNodes = buildTemplateNodes(project.id, rootPath, template ?? "empty");
  if (templateNodes.length > 0) {
    await db.insert(nodesTable).values(templateNodes);
  }

  // Record creation in audit
  const afterNodes = await db.select().from(nodesTable).where(eq(nodesTable.projectId, project.id));
  await db.insert(auditEntriesTable).values({
    projectId: project.id,
    changeId: randomUUID(),
    operation: "create",
    status: "success",
    summary: `Project "${project.name}" created${templateNodes.length ? ` with ${templateNodes.length} ${template} template nodes` : ""}`,
    snapshotBefore: [],
    snapshotAfter: afterNodes.map(serializeNode),
    canRestore: false,
  });

  const fileCount = templateNodes.filter((n) => n.kind === "file").length;
  const folderCount = templateNodes.filter((n) => n.kind === "folder").length;
  return res.status(201).json(serializeProject(project, fileCount, folderCount));
});

// GET /projects/:projectId
router.get("/:projectId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const data = await getProjectWithCounts(projectId);
  if (!data) return res.status(404).json({ error: "Project not found" });
  return res.json({
    ...serializeProject(data.project, data.fileCount, data.folderCount),
    nodes: data.nodes.map(serializeNode),
  });
});

// DELETE /projects/:projectId
router.delete("/:projectId", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const [deleted] = await db.delete(projectsTable).where(eq(projectsTable.id, projectId)).returning();
  if (!deleted) return res.status(404).json({ error: "Project not found" });
  return res.status(204).send();
});

// GET /projects/:projectId/summary
router.get("/:projectId/summary", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, projectId) });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const nodes = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  const pendingPlans = await db
    .select({ id: movePlansTable.id })
    .from(movePlansTable)
    .where(sql`${movePlansTable.projectId} = ${projectId} AND ${movePlansTable.status} = 'pending'`);
  const auditCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditEntriesTable)
    .where(eq(auditEntriesTable.projectId, projectId));
  const recentAudit = await db
    .select()
    .from(auditEntriesTable)
    .where(eq(auditEntriesTable.projectId, projectId))
    .orderBy(sql`${auditEntriesTable.createdAt} DESC`)
    .limit(5);

  const fileCount = nodes.filter((n) => n.kind === "file").length;
  const folderCount = nodes.filter((n) => n.kind === "folder").length;
  const movableCount = nodes.filter((n) => n.movable).length;
  const maxDepth = nodes.reduce((acc, n) => Math.max(acc, n.depth), 0);

  return res.json({
    projectId,
    totalNodes: nodes.length,
    fileCount,
    folderCount,
    movableCount,
    maxDepth,
    pendingPlansCount: pendingPlans.length,
    auditEntriesCount: Number(auditCount[0]?.count ?? 0),
    recentActivity: recentAudit.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      changeId: e.changeId,
      operation: e.operation,
      planId: e.planId ?? null,
      status: e.status,
      summary: e.summary,
      snapshotBefore: e.snapshotBefore,
      snapshotAfter: e.snapshotAfter,
      canRestore: e.canRestore,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

// GET /projects/:projectId/validate
router.get("/:projectId/validate", async (req, res) => {
  const projectId = parseInt(req.params.projectId);
  const project = await db.query.projectsTable.findFirst({ where: eq(projectsTable.id, projectId) });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const nodes = await db.select().from(nodesTable).where(eq(nodesTable.projectId, projectId));
  const issues: Array<{ kind: string; severity: string; message: string; nodeId: string | null }> = [];

  // Check duplicate physical paths
  const physPaths = nodes.map((n) => n.physicalPath);
  const seen = new Set<string>();
  for (const n of nodes) {
    if (seen.has(n.physicalPath)) {
      issues.push({ kind: "duplicate_path", severity: "error", message: `Duplicate physical path: ${n.physicalPath}`, nodeId: n.id });
    }
    seen.add(n.physicalPath);
  }

  // Check orphan nodes (parentId references non-existent node)
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    if (n.parentId && !nodeIds.has(n.parentId)) {
      issues.push({ kind: "orphan_node", severity: "warning", message: `Node "${n.name}" references missing parent ${n.parentId}`, nodeId: n.id });
    }
  }

  // Check root escape (physical path not starting with project rootPath)
  for (const n of nodes) {
    if (!n.physicalPath.startsWith(project.rootPath)) {
      issues.push({ kind: "root_escape", severity: "error", message: `Node "${n.name}" escapes project root`, nodeId: n.id });
    }
  }

  // Check reserved names
  const reserved = [".git", "node_modules", "__pycache__", ".DS_Store"];
  for (const n of nodes) {
    if (reserved.includes(n.name)) {
      issues.push({ kind: "reserved_name", severity: "warning", message: `Node "${n.name}" uses a reserved name`, nodeId: n.id });
    }
  }

  return res.json({ valid: issues.filter((i) => i.severity === "error").length === 0, issues });
});

export default router;
