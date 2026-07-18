import { Router } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import nodesRouter from "./nodes";
import plansRouter from "./plans";
import auditListRouter from "./auditList";
import restoreRouter from "./restore";

const router = Router();

router.use("/healthz", healthRouter);
router.use("/projects/:projectId/nodes", nodesRouter);
router.use("/projects/:projectId/plans", plansRouter);
router.use("/projects/:projectId/audit", auditListRouter);
router.use("/projects/:projectId/restore", restoreRouter);
router.use("/projects", projectsRouter);

export default router;
