const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export function toggleModel(followed: string[], model: string): string[] {
  return followed.some((item) => normalize(item) === normalize(model))
    ? followed.filter((item) => normalize(item) !== normalize(model))
    : [...followed, model];
}

/** Catalog models first; followed models no longer in the catalog stay visible to unfollow. */
export function modelChoices(
  catalog: ReadonlyArray<{ vendor: string; model: string }>,
  followed: string[]
): string[] {
  const choices = catalog.map(({ model }) => model);
  const known = new Set(choices.map(normalize));
  return [...choices, ...followed.filter((model) => !known.has(normalize(model)))];
}
