import { ZenodoDoiProvider } from './zenodo';
import { LocalHandleProvider } from './handle';
import type { DoiProvider, HandleProvider, IdentifierStatus } from './types';

export { ZenodoDoiProvider } from './zenodo';
export { LocalHandleProvider } from './handle';
export type { DoiProvider, HandleProvider, IdentifierStatus } from './types';

const zenodo = new ZenodoDoiProvider();
const localHandle = new LocalHandleProvider();

export function getDoiProvider(): DoiProvider | null {
  return zenodo.isAvailable() ? zenodo : null;
}

export function getHandleProvider(): HandleProvider {
  return localHandle;
}

export function getIdentifierStatus() {
  return {
    doiProvider: zenodo.isAvailable() ? zenodo.name : null,
    handleProvider: localHandle.name,
  };
}
