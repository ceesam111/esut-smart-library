export function isMissingSchemaError(error: unknown) {
  const value = error as { code?: string; message?: string; details?: string } | null | undefined;
  const text = `${value?.code ?? ''} ${value?.message ?? ''} ${value?.details ?? ''}`;
  return /PGRST20[045]|schema cache|does not exist|relation .* does not exist|column .* does not exist|Could not find the table/i.test(text);
}
