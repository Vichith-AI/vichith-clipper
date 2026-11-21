import { EC2Client, DescribeInstancesCommand, StartInstancesCommand } from '@aws-sdk/client-ec2';

export interface WorkerInstanceStatus {
    configured: boolean;
    instanceId: string;
    region: string;
    state: 'running' | 'pending' | 'stopping' | 'stopped' | 'shutting-down' | 'unknown';
    publicIp?: string | null;
    stateReason?: string | null;
    lastChecked: string;
    error?: string | null;
}

const DEFAULT_INSTANCE_ID = 'i-0b493811ffcdff29b';
const DEFAULT_REGION = 'ap-south-2';

// 15-second cache to prevent spamming DescribeInstances
let cachedStatus: WorkerInstanceStatus | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 15000;

function getEc2Client(): { client: EC2Client; instanceId: string; region: string } | null {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.CPU_WORKER_AWS_REGION || process.env.AWS_REGION || DEFAULT_REGION;
    const instanceId = process.env.CPU_WORKER_INSTANCE_ID || DEFAULT_INSTANCE_ID;

    if (!accessKeyId || !secretAccessKey) {
        return null;
    }

    const client = new EC2Client({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });

    return { client, instanceId, region };
}

export async function getWorkerStatus(force = false): Promise<WorkerInstanceStatus> {
    const now = Date.now();
    if (!force && cachedStatus && (now - lastCheckTime < CACHE_TTL_MS)) {
        return cachedStatus;
    }

    const config = getEc2Client();
    const region = process.env.CPU_WORKER_AWS_REGION || process.env.AWS_REGION || DEFAULT_REGION;
    const instanceId = process.env.CPU_WORKER_INSTANCE_ID || DEFAULT_INSTANCE_ID;

    if (!config) {
        const status: WorkerInstanceStatus = {
            configured: false,
            instanceId,
            region,
            state: 'unknown',
            lastChecked: new Date().toISOString(),
            error: 'AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) not configured on server.',
        };
        cachedStatus = status;
        lastCheckTime = now;
        return status;
    }

    try {
        const command = new DescribeInstancesCommand({
            InstanceIds: [config.instanceId],
        });
        const response = await config.client.send(command);
        const reservation = response.Reservations?.[0];
        const instance = reservation?.Instances?.[0];

        if (!instance) {
            const status: WorkerInstanceStatus = {
                configured: true,
                instanceId: config.instanceId,
                region: config.region,
                state: 'unknown',
                lastChecked: new Date().toISOString(),
                error: `Instance ${config.instanceId} not found in region ${config.region}.`,
            };
            cachedStatus = status;
            lastCheckTime = now;
            return status;
        }

        const stateName = (instance.State?.Name as WorkerInstanceStatus['state']) || 'unknown';
        const publicIp = instance.PublicIpAddress || null;
        const stateReason = instance.StateTransitionReason || null;

        const status: WorkerInstanceStatus = {
            configured: true,
            instanceId: config.instanceId,
            region: config.region,
            state: stateName,
            publicIp,
            stateReason,
            lastChecked: new Date().toISOString(),
        };

        cachedStatus = status;
        lastCheckTime = now;
        return status;
    } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const status: WorkerInstanceStatus = {
            configured: true,
            instanceId: config.instanceId,
            region: config.region,
            state: 'unknown',
            lastChecked: new Date().toISOString(),
            error: errorMsg,
        };
        cachedStatus = status;
        lastCheckTime = now;
        return status;
    }
}

export async function wakeWorker(): Promise<{ ok: boolean; previousState?: string; currentState?: string; error?: string }> {
    const config = getEc2Client();
    if (!config) {
        return {
            ok: false,
            error: 'Cannot wake worker: AWS credentials are not configured on server environment.',
        };
    }

    try {
        const command = new StartInstancesCommand({
            InstanceIds: [config.instanceId],
        });
        const response = await config.client.send(command);
        const change = response.StartingInstances?.[0];

        // Invalidate cache immediately on wake
        cachedStatus = null;
        lastCheckTime = 0;

        return {
            ok: true,
            previousState: change?.PreviousState?.Name,
            currentState: change?.CurrentState?.Name || 'pending',
        };
    } catch (err: any) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
