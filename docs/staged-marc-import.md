# Staged MARC Import

## Overview

Staged MARC import workflow: source → parse → validate → stage → duplicate detection → preview → librarian decision → import.

## Database

- `marc_import_batches` — Import batch tracking
- `marc_import_records` — Staged records with validation and duplicate status

## Record States

PENDING → VALID / WARNING / ERROR → READY → IMPORTED / SKIPPED / REJECTED

## API

- `POST /api/catalogue/marc-import` — Create batch and stage records
- `GET /api/catalogue/marc-import?batchId=...` — Get batch and staged records

## Server Module

- `src/server/catalogue/marcImport.ts` — createImportBatch, stageMarcRecord, getStagedRecords, importRecord

## Duplicate Detection

- ISBN exact match → STRONG_MATCH
- ISSN exact match → STRONG_MATCH
- Title normalized match → STRONG_MATCH
- Title ILIKE → POSSIBLE_MATCH
- No match → NO_MATCH

## Status

Server-side complete. UI pending.
