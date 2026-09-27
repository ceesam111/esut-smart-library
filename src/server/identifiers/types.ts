export interface DoiProvider {
  name: string;
  mintDoi(input: { title: string; creators: string[]; year?: number; metadata?: Record<string, unknown> }): Promise<{ doi: string; url: string } | null>;
  isAvailable(): boolean;
}

export interface HandleProvider {
  name: string;
  mintHandle(input: { year?: number; id?: string }): Promise<string>;
  isAvailable(): boolean;
}

export interface IdentifierStatus {
  doiProvider: string | null;
  handleProvider: string | null;
}
