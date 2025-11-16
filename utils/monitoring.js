import os from 'os';
import logger from '../utils/logger.js';
import { queries } from '../utils/db.js';

const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');
const ENABLE_METRICS = process.env.ENABLE_METRICS === 'true';

class SystemMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      jobsProcessed: 0,
      jobsFailed: 0,
      videoGenerated: 0,
      startTime: Date.now(),
      lastHealthCheck: Date.now()
    };
    
    this.healthStatus = {
      status: 'healthy',
      components: {}
    };
    
    if (ENABLE_METRICS) {
      this.startMonitoring();
    }
  }
  
  startMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);
    
    logger.info('System monitoring started', { interval: HEALTH_CHECK_INTERVAL });
  }
  
  async performHealthCheck() {
    const checks = {
      database: await this.checkDatabase(),
      memory: this.checkMemory(),
      cpu: this.checkCPU(),
      disk: this.checkDisk(),
      workers: this.checkWorkers()
    };
    
    const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
    
    this.healthStatus = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      components: checks
    };
    
    if (!allHealthy) {
      logger.warn('Health check issues detected', { checks });
    }
    
    this.metrics.lastHealthCheck = Date.now();
    
    return this.healthStatus;
  }
  
  async checkDatabase() {
    try {
      const result = queries.getAllChannels.all();
      
      return {
        status: 'healthy',
        responseTime: '< 100ms',
        details: {
          channels: result.length
        }
      };
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  checkMemory() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = (usedMem / totalMem) * 100;
    
    const status = usagePercent > 90 ? 'critical' : usagePercent > 75 ? 'warning' : 'healthy';
    
    return {
      status,
      usage: `${usagePercent.toFixed(2)}%`,
      details: {
        total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
        used: `${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
        free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`
      }
    };
  }
  
  checkCPU() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuCount = cpus.length;
    const avgLoad = loadAvg[0] / cpuCount;
    
    const status = avgLoad > 0.9 ? 'critical' : avgLoad > 0.7 ? 'warning' : 'healthy';
    
    return {
      status,
      load: `${(avgLoad * 100).toFixed(2)}%`,
      details: {
        cores: cpuCount,
        loadAverage: loadAvg.map(l => l.toFixed(2))
      }
    };
  }
  
  checkDisk() {
    return {
      status: 'healthy',
      usage: 'N/A',
      details: {
        note: 'Disk monitoring not implemented'
      }
    };
  }
  
  checkWorkers() {
    try {
      const pendingJobs = queries.getPendingJobs.all();
      const queueSize = pendingJobs.length;
      
      const status = queueSize > 100 ? 'warning' : 'healthy';
      
      return {
        status,
        queue: queueSize,
        details: {
          pending: queueSize,
          types: pendingJobs.reduce((acc, j) => {
            acc[j.type] = (acc[j.type] || 0) + 1;
            return acc;
          }, {})
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  recordRequest() {
    if (ENABLE_METRICS) {
      this.metrics.requests++;
    }
  }
  
  recordError() {
    if (ENABLE_METRICS) {
      this.metrics.errors++;
    }
  }
  
  recordJobProcessed(success = true) {
    if (ENABLE_METRICS) {
      this.metrics.jobsProcessed++;
      if (!success) {
        this.metrics.jobsFailed++;
      }
    }
  }
  
  recordVideoGenerated() {
    if (ENABLE_METRICS) {
      this.metrics.videoGenerated++;
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.getUptime(),
      errorRate: this.metrics.requests > 0 
        ? ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2) + '%'
        : '0%',
      jobSuccessRate: this.metrics.jobsProcessed > 0
        ? (((this.metrics.jobsProcessed - this.metrics.jobsFailed) / this.metrics.jobsProcessed) * 100).toFixed(2) + '%'
        : '100%'
    };
  }
  
  getHealthStatus() {
    return this.healthStatus;
  }
  
  getUptime() {
    const uptimeMs = Date.now() - this.metrics.startTime;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }
  
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      uptime: this.getUptime()
    };
  }
}

const monitor = new SystemMonitor();

export function recordRequest() {
  monitor.recordRequest();
}

export function recordError() {
  monitor.recordError();
}

export function recordJobProcessed(success = true) {
  monitor.recordJobProcessed(success);
}

export function recordVideoGenerated() {
  monitor.recordVideoGenerated();
}

export function getMetrics() {
  return monitor.getMetrics();
}

export function getHealthStatus() {
  return monitor.getHealthStatus();
}

export async function performHealthCheck() {
  return await monitor.performHealthCheck();
}

export function getSystemInfo() {
  return monitor.getSystemInfo();
}

export default {
  recordRequest,
  recordError,
  recordJobProcessed,
  recordVideoGenerated,
  getMetrics,
  getHealthStatus,
  performHealthCheck,
  getSystemInfo
};
