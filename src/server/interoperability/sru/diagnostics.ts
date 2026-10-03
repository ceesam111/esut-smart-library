import { xmlEscape } from '@/server/oai/oaiXml';

export interface SRUDiagnostic {
  uri: string;
  details: string | undefined;
  message: string;
}

export function sruDiagnostic(number: number, message: string, details?: string): SRUDiagnostic {
  return {
    uri: `info:srw/diagnostic/1/${number}`,
    details,
    message,
  };
}

export function diagnosticToXML(diagnostic: SRUDiagnostic): string {
  return `  <diagnostics>
    <diagnostic xmlns="http://www.loc.gov/zing/srw/diagnostic/">
      <uri>${xmlEscape(diagnostic.uri)}</uri>
      ${diagnostic.details ? `<details>${xmlEscape(diagnostic.details)}</details>` : ''}
      <message>${xmlEscape(diagnostic.message)}</message>
    </diagnostic>
  </diagnostics>`;
}

export function errorResponse(diagnostic: SRUDiagnostic): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.2</version>
${diagnosticToXML(diagnostic)}
</searchRetrieveResponse>`;
}

export const SRU_DIAGNOSTICS = {
  UNKNOWN_OPERATION: (op: string) => sruDiagnostic(1, `Unknown operation: ${op}. Supported: explain, searchRetrieve.`),
  MISSING_QUERY: () => sruDiagnostic(7, 'Missing query parameter.'),
  MALFORMED_CQL: (detail: string) => sruDiagnostic(10, 'Malformed CQL query.', detail),
  UNSUPPORTED_INDEX: (index: string) => sruDiagnostic(11, `Unsupported index: ${index}.`),
  UNSUPPORTED_RELATION: (relation: string) => sruDiagnostic(12, `Unsupported relation: ${relation}.`),
  UNSUPPORTED_SCHEMA: (schema: string) => sruDiagnostic(13, `Unsupported record schema: ${schema}.`),
  INVALID_START_RECORD: (value: string) => sruDiagnostic(14, `Invalid startRecord: ${value}. Must be a positive integer.`),
  INVALID_MAXIMUM_RECORDS: (value: string) => sruDiagnostic(15, `Invalid maximumRecords: ${value}. Must be a positive integer.`),
  DATABASE_ERROR: (detail: string) => sruDiagnostic(6, 'Database error.', detail),
};
