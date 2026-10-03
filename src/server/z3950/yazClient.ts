import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface YAZRecord {
  leader: string;
  fields: Array<{
    tag: string;
    value?: string;
    ind1?: string;
    ind2?: string;
    subfields?: Array<{ code: string; value: string }>;
  }>;
}

export interface YAZSearchResult {
  hitCount: number;
  records: YAZRecord[];
  nextPosition: number | null;
  rawOutput: string;
}

export interface YAZRunOptions {
  host: string;
  port: number;
  database: string;
  pqf: string;
  maxRecords?: number;
  timeoutMs?: number;
}

export class YAZError extends Error {
  constructor(public code: 'TIMEOUT' | 'CONNECTION_FAILED' | 'SEARCH_FAILED' | 'EXEC_FAILED', message: string) {
    super(message);
    this.name = 'YAZError';
  }
}

export async function runYAZSearch(options: YAZRunOptions): Promise<YAZSearchResult> {
  const { host, port, database, pqf, maxRecords = 20, timeoutMs = 30000 } = options;

  const id = randomUUID();
  const cmdFile = join(tmpdir(), `yaz-cmds-${id}.txt`);
  const recFile = join(tmpdir(), `yaz-recs-${id}.mrc`);

  const commands = [
    `open tcp:${host}:${port}/${database}`,
    `find ${pqf}`,
    `show 1+${maxRecords}`,
    'close',
    'quit',
  ].join('\n') + '\n';

  await writeFile(cmdFile, commands, 'utf-8');

  try {
    const stdout = await execFileAsync('yaz-client', ['-f', cmdFile, '-m', recFile], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });

    if (stdout.includes('Not connected yet') || stdout.includes('lower-layer) error')) {
      throw new YAZError('CONNECTION_FAILED', `Could not connect to ${host}:${port}`);
    }

    if (stdout.includes("bloomin' failure") || stdout.includes('Search was a failure')) {
      const diagMatch = stdout.match(/Diagnostic message\(s\) from database:\s*([\s\S]*?)(?:\n\n|\nSent|\nElapsed)/);
      throw new YAZError('SEARCH_FAILED', diagMatch?.[1]?.trim() || 'Search failed');
    }

    const hitMatch = stdout.match(/Number of hits:\s*([\d,]+)/);
    const hitCount = hitMatch ? parseInt(hitMatch[1].replace(/,/g, ''), 10) : 0;

    const nextMatch = stdout.match(/nextResultSetPosition\s*=\s*(\d+)/);
    const nextPosition = nextMatch ? parseInt(nextMatch[1], 10) : null;

    let records: YAZRecord[] = [];
    try {
      const marcdump = await execFileAsync('yaz-marcdump', ['-o', 'json', recFile], { timeout: 10000, maxBuffer: 10 * 1024 * 1024 });
      records = parseMarcJSON(marcdump);
    } catch {
      // marcdump failed or no records
    }

    return { hitCount, records, nextPosition, rawOutput: stdout };
  } finally {
    await unlink(cmdFile).catch(() => {});
    await unlink(recFile).catch(() => {});
  }
}

function execFileAsync(cmd: string, args: string[], opts: { timeout: number; maxBuffer: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (error, stdout) => {
      if (error && error.killed) {
        reject(new YAZError('TIMEOUT', `YAZ operation timed out after ${opts.timeout}ms`));
      } else if (error) {
        reject(new YAZError('EXEC_FAILED', error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

function parseMarcJSON(json: string): YAZRecord[] {
  const data = JSON.parse(json);
  const records: unknown[] = Array.isArray(data) ? data : [data];
  return records.map((rec: unknown) => {
    const r = rec as Record<string, unknown>;
    const fields = (r.fields as Array<Record<string, unknown>> || []).map((f) => {
      const tag = Object.keys(f)[0];
      const val = f[tag];
      if (typeof val === 'string') {
        return { tag, value: val };
      }
      const v = val as Record<string, unknown>;
      return {
        tag,
        ind1: v.ind1 as string | undefined,
        ind2: v.ind2 as string | undefined,
        subfields: v.subfields as Array<{ code: string; value: string }> | undefined,
      };
    });
    return { leader: (r.leader as string) || '', fields };
  });
}
