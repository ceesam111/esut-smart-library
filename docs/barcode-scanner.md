# Barcode Scanner

## Overview

The admin scanner at `/admin/catalogue/scan` is mobile-first and Supabase-compatible. It supports resource staging and internal Code-128 lookup without writing directly to the live catalogue.

No QR scanning is implemented.

## Modes

- Catalogue: scans ISBN/EAN-13 or ISSN-like numeric codes and stages records into `catalogue_staging` with `source='scan'`.
- Internal lookup: resolves Code-128 prefixes such as `PAT-`, `COPY-`, `THS-`, `SHF-`, and `EQP-` through a server route.
- Manual: always available fallback that stages records with `source='manual'`.

## Camera Support

- Primary scanner: browser `BarcodeDetector` API.
- Fallback scanner: `@ericblade/quagga2`.
- iOS Safari requirements are handled in the video setup: `playsInline`, `muted`, `autoPlay`, HTTPS, and `facingMode: environment`.
- Permission denied states show retry instructions.

## Server Routes

- `POST /api/admin/catalogue/scan/stage`: validates/enriches/stages scan/manual rows.
- `POST /api/admin/barcode-lookup`: resolves internal Code-128 labels.

Both routes require Supabase bearer auth and server-side librarian/admin role checks.

## Barcode Generation

The generator at `/admin/barcodes` uses JsBarcode to create Code-128 labels for `PAT-`, `COPY-`, `THS-`, `SHF-`, and `EQP-` records.

## Offline Tolerance

If the scanner cannot stage while offline, scans are queued in localStorage under `smart-library-unsynced-scans` and can be retried later from the scanner page.

## Supabase Compatibility

- Hosted Supabase works now.
- Self-hosted Supabase later only requires environment/function endpoint changes and deployed migrations/functions.
- Service-role keys are only used server-side.
- Tenant isolation remains enforced by server checks and Supabase RLS.
