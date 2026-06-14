import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, agentsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * POST /api/public/chat/start
 * No auth required. Creates (or reuses) a guest conversation for the given agent.
 * Body: { agentId: number, guestName?: string }
 * Returns: { convId: number, agentName: string }
 */
router.post("/public/chat/start", async (req, res): Promise<void> => {
  const agentId = parseInt(req.body?.agentId, 10);
  const guestName: string = req.body?.guestName?.trim() || "אורח";

  if (!agentId || isNaN(agentId)) {
    res.status(400).json({ error: "agentId required" });
    return;
  }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  // Find or create a dedicated "Public Guest" client
  let [guestClient] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.name, "__public_guest__"));

  if (!guestClient) {
    const [created] = await db
      .insert(clientsTable)
      .values({ name: "__public_guest__", industry: "general", contactEmail: "guest@agenthub.guru", tier: "starter" })
      .returning();
    guestClient = created;
  }

  // Create a fresh conversation for this visitor
  const [conv] = await db
    .insert(conversationsTable)
    .values({
      clientId: guestClient.id,
      agentId: agent.id,
      title: `שיחה עם ${guestName}`,
      messages: JSON.stringify([]),
      messageCount: 0,
    })
    .returning();

  res.json({ convId: conv.id, agentName: agent.name });
});

export default router;
