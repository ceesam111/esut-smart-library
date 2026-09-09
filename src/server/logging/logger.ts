import winston from 'winston';

const REDACTED = '[redacted]';
const SECRET_KEYS = /authorization|cookie|token|secret|password|api[-_]?key|service[-_]?role|application[-_]?key|jwt|session/i;

export type LogContext = Record<string, unknown> & {
  requestId?: string;
  tenantSlug?: string | null;
  tenantId?: string | null;
};

export function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/bearer\s+[a-z0-9._-]+/i.test(value)) return value.replace(/bearer\s+[a-z0-9._-]+/i, `Bearer ${REDACTED}`);
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, SECRET_KEYS.test(key) ? REDACTED : redact(val)]));
  }
  return value;
}

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => JSON.stringify(redact(info)))
);

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = redact(info) as Record<string, unknown>;
    const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${suffix}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels: winston.config.npm.levels,
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
});

export function childLogger(context: LogContext) {
  return logger.child(redact(context) as Record<string, unknown>);
}
