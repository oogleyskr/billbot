export type SshTunnelMonitorConfig = {
  /** Label for display in health output. */
  label?: string;
  /** Host to check port reachability on (default: localhost). */
  host?: string;
  /** TCP port to probe. */
  port: number;
  /** Optional systemd service name to check status of. */
  serviceName?: string;
  /** Timeout for TCP connection check in ms (default: 5000). */
  timeoutMs?: number;
};

export type GpuMetricsConfig = {
  /** Enable GPU metrics collection (default: false). */
  enabled?: boolean;
  /** Collect from local machine or via SSH to a remote host. */
  mode?: "local" | "remote";
  /** SSH host for remote GPU metrics (required if mode=remote). */
  sshHost?: string;
  /** SSH user for remote GPU metrics. */
  sshUser?: string;
  /** SSH key path for remote GPU metrics. */
  sshKeyPath?: string;
  /** SSH port for remote GPU metrics (default: 22). */
  sshPort?: number;
  /** How often to collect metrics in seconds (default: 30). */
  intervalSeconds?: number;
};

export type InfrastructureConfig = {
  /** SSH tunnel endpoints to monitor for connectivity. */
  tunnels?: SshTunnelMonitorConfig[];
  /** GPU metrics collection configuration. */
  gpu?: GpuMetricsConfig;
};
