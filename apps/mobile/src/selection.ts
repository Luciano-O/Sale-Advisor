const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export function toggleModel(followed: string[], model: string): string[] {
  return followed.some((item) => normalize(item) === normalize(model))
    ? followed.filter((item) => normalize(item) !== normalize(model))
    : [...followed, model];
}

export interface ProductResult {
  model: string;
  vendor: string;
  /** The name split around what was typed, for highlighting. */
  pre: string;
  match: string;
  post: string;
}

const SEARCH_LIMIT = 8;

/** Every typed word must appear in the name, in any order, within one subcategory. */
export function searchProducts(
  catalog: ReadonlyArray<{ category: string; vendor: string; model: string }>,
  query: string,
  category: string,
  limit = SEARCH_LIMIT
): { results: ProductResult[]; total: number } {
  const typed = normalize(query);
  const words = typed.split(/\s+/).filter(Boolean);
  const matches = catalog.filter(
    ({ category: productCategory, model }) =>
      productCategory === category && words.every((word) => normalize(model).includes(word))
  );
  return {
    total: matches.length,
    results: matches.slice(0, limit).map(({ model, vendor }) => {
      const at = typed ? normalize(model).indexOf(typed) : -1;
      return at < 0
        ? { model, vendor, pre: model, match: "", post: "" }
        : {
            model,
            vendor,
            pre: model.slice(0, at),
            match: model.slice(at, at + typed.length),
            post: model.slice(at + typed.length)
          };
    })
  };
}
