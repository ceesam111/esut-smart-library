import type { AccreditationProvider } from '../types';
import { arxivProvider } from './arxiv';
import { coreProvider } from './core';
import { crossrefProvider } from './crossref';
import { doajProvider } from './doaj';
import { europePmcProvider } from './europePmc';
import { internetArchiveProvider } from './internetArchive';
import { openalexProvider } from './openalex';
import { openLibraryProvider } from './openLibrary';
import { semanticScholarProvider } from './semanticScholar';
import { zenodoProvider } from './zenodo';

export const accreditationProviders: AccreditationProvider[] = [
  openalexProvider,
  crossrefProvider,
  doajProvider,
  europePmcProvider,
  coreProvider,
  semanticScholarProvider,
  arxivProvider,
  internetArchiveProvider,
  openLibraryProvider,
  zenodoProvider,
];

const providerById = new Map(accreditationProviders.map((provider) => [provider.id, provider]));

export const accreditationProviderById = (id: string): AccreditationProvider | undefined => providerById.get(id);

const isEnabled = (provider: AccreditationProvider): boolean => {
  try {
    return provider.enabled();
  } catch {
    return false;
  }
};

export const enabledProviders = (): AccreditationProvider[] =>
  accreditationProviders.filter((provider) => isEnabled(provider));

export const providerSummary = (): Array<{ id: string; displayName: string; enabled: boolean }> =>
  accreditationProviders.map((provider) => ({
    id: provider.id,
    displayName: provider.displayName,
    enabled: isEnabled(provider),
  }));