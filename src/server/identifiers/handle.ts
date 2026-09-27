import type { HandleProvider } from './types';

export class LocalHandleProvider implements HandleProvider {
  name = 'local';

  isAvailable(): boolean {
    return true;
  }

  async mintHandle(input: { year?: number; id?: string }): Promise<string> {
    const year = input.year || new Date().getFullYear();
    const id = input.id || crypto.randomUUID().slice(0, 8);
    return `esutir/${year}/${id}`;
  }
}
