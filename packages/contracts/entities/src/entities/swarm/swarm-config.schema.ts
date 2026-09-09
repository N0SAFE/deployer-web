import z from "zod/v4";

/**
 * Swarm participation — how THIS node joins (or refrains from) the Docker
 * Swarm cluster, and the role policy it enforces on itself.
 *
 * Decided at setup time (the wizard surfaces it) and persisted on the local
 * `node_config` row (JSON) so it survives restarts without env injection.
 *
 * Mode (HOW this node participates):
 *   "create"   — the node initializes a NEW Swarm cluster ("become founder").
 *   "join"     — the node joins an EXISTING cluster (worker or manager token).
 *   "disabled" — the node never joins Swarm; all supervised processes run as
 *                plain containers (edge/constrained hosts, non-clustered).
 *
 * Policy (WHAT role this node holds — the fleet topology the UI explains):
 *   "auto"     — MIXED master + worker. The node is a manager AND keeps
 *                scheduling workloads. Best for small clusters (2-3 nodes)
 *                where no server can be dedicated to control-plane only.
 *   "manager"  — DEDICATED MASTER. The node is a manager that does NOT run
 *                workload tasks (drained) — reserved for larger fleets with a
 *                dedicated control node.
 *   "worker"   — PURE WORKER. The node runs workloads only; control-plane
 *                lives elsewhere. Only meaningful with mode="join".
 *
 * Join: the token + control-plane addresses used when mode="join".
 */

export const swarmNodePolicySchema = z.enum(["auto", "manager", "worker"]);
export type SwarmNodePolicy = z.infer<typeof swarmNodePolicySchema>;

export const swarmParticipationModeSchema = z.enum(["create", "join", "disabled"]);
export type SwarmParticipationMode = z.infer<typeof swarmParticipationModeSchema>;

/** Operator-facing input (setup wizard / cluster config UI). */
export const swarmConfigInputSchema = z.object({
    mode: swarmParticipationModeSchema.optional(),
    policy: swarmNodePolicySchema.optional(),
    /** Advertise address override (e.g. "10.0.0.5:2377"). Empty → engine/loopback default. */
    advertiseAddr: z.string().trim().optional().nullable(),
    /** Join token (mode="join"). Never echoed back in views. */
    joinToken: z.string().trim().optional().nullable(),
    /** Control-plane reachable addresses, "host:port" each (mode="join"). */
    joinAddrs: z.array(z.string().min(1)).optional().default([]),
});
export type SwarmConfigInput = z.infer<typeof swarmConfigInputSchema>;

/** Persisted shape (node_config.swarmConfig). */
export const swarmConfigSchema = z.object({
    mode: swarmParticipationModeSchema.default("create"),
    policy: swarmNodePolicySchema.default("auto"),
    advertiseAddr: z.string().nullable().default(null),
    joinToken: z.string().nullable().default(null),
    joinAddrs: z.array(z.string().min(1)).default([]),
});
export type SwarmConfig = z.infer<typeof swarmConfigSchema>;

/** Describe one policy for the UI (why/when to pick it). */
export const swarmPolicyDocumentSchema = z.object({
    policy: swarmNodePolicySchema,
    name: z.string().min(1),
    description: z.string().min(1),
    bestFor: z.string().min(1),
    role: z.enum(["manager", "worker"]),
    schedulesWorkloads: z.boolean(),
    recommended: z.boolean().default(false),
});
export type SwarmPolicyDocument = z.infer<typeof swarmPolicyDocumentSchema>;

/** Live engine state + effective participation — what the UI shows. */
export const swarmConfigViewSchema = z.object({
    /** SWARM_ENABLED gate from env. */
    envEnabled: z.boolean(),
    /** Persisted + env-merged participation resolve. */
    participation: swarmConfigSchema,
    /** True when node_config says setup completed. */
    setupDone: z.boolean(),
    /** Local engine swarm state ("active" | "inactive" | "pending" | "locked"). */
    engineState: z.string(),
    /** Local node swarm role (manager | worker | none). */
    role: z.string(),
    /** Local node availability (active | pause | drain). */
    availability: z.string(),
    /** Cluster size when active, else 0. */
    nodeCount: z.number().int().min(0),
    managerCount: z.number().int().min(0),
    /** Present only when engine is an active manager: share to onboard peers. */
    joinTokens: z
        .object({ worker: z.string(), manager: z.string() })
        .nullable()
        .default(null),
    /** Human-readable explanation of the current resolve (drives UX). */
    resolveNote: z.string(),
    /** Policy documents for the configuration UI. */
    policies: z.array(swarmPolicyDocumentSchema).default([]),
});
export type SwarmConfigView = z.infer<typeof swarmConfigViewSchema>;