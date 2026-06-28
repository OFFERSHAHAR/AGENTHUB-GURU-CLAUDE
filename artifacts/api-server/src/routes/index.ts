import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import agentsRouter from "./agents";
import clientsRouter from "./clients";
import assignmentsRouter from "./assignments";
import orchestratorsRouter from "./orchestrators";
import statsRouter from "./stats";
import workflowsRouter from "./workflows";
import telegramRouter from "./telegram";
import conversationsRouter from "./conversations";
import specAgentRouter from "./spec-agent";
import langAgentRouter from "./lang-agent";
import logsRouter from "./logs";
import triggersRouter from "./triggers";
import automationsRouter from "./automations";
import maintenanceRouter, { startMaintenanceScheduler } from "./maintenance";
import rpaConnectorsRouter from "./rpa-connectors";
import studyRouter from "./study";
import palgateRouter from "./palgate";
import settingsRouter from "./settings";
import jarvisRouter from "./jarvis";
import optimaSyncRouter from "./optima-sync";
import whatsappRouter from "./whatsapp";
import { startWhatsAppScheduler } from "../services/whatsapp-daily";
import { startLogProcessor } from "../services/log-processor";
import { startOptimaScheduler } from "../services/optima-sync";
import emailRouter from "./email";
import emailClassifierRouter from "./email-classifier";
import publicChatRouter from "./public-chat";
import controlRoomRouter from "./control-room";
import opensourceRouter from "./opensource";
import { requireAuth } from "../middleware/require-auth";

const router: IRouter = Router();

// Start the 30-min log analysis scheduler (non-blocking)
startLogProcessor();

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth);
router.use(agentsRouter);
router.use(clientsRouter);
router.use(assignmentsRouter);
router.use(orchestratorsRouter);
router.use(statsRouter);
router.use(workflowsRouter);
router.use(telegramRouter);
router.use(conversationsRouter);
router.use(specAgentRouter);
router.use(langAgentRouter);
router.use(logsRouter);
router.use(triggersRouter);
router.use(automationsRouter);
router.use(maintenanceRouter);
router.use(rpaConnectorsRouter);
router.use(studyRouter);
router.use(palgateRouter);
router.use(settingsRouter);
router.use(jarvisRouter);
router.use(optimaSyncRouter);
router.use(whatsappRouter);
router.use(emailRouter);
router.use(emailClassifierRouter);
router.use(publicChatRouter);
router.use(controlRoomRouter);
router.use(opensourceRouter);

// Start daily 05:00 maintenance scheduler (non-blocking)
startMaintenanceScheduler();

// Start the Optima occupancy sync scheduler (every-N-hours, human-approved)
startOptimaScheduler();

// Start the WhatsApp daily report scheduler (fires at configured hour, Israel TZ)
startWhatsAppScheduler();

export default router;
