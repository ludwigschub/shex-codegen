import path from "path";

import camelcase from "camelcase";

export function normalizeUrl(
  url: string,
  capitalize?: boolean,
  not?: string,
  prefixes?: any
) {
  const urlObject = new URL(url);
  let normalized = camelcase(
    urlObject.hash === ""
      ? path.parse(urlObject.pathname).name
      : urlObject.hash.replace(/#+/, "")
  );

  if (not && normalized.toLowerCase() === not.toLowerCase()) {
    const namespaceUrl = url.replace(
      urlObject.hash === ""
        ? path.parse(urlObject.pathname).name
        : urlObject.hash,
      ""
    );
    const namespacePrefix = Object.keys(prefixes).find(
      (key) => prefixes[key] === namespaceUrl
    );
    normalized =
      namespacePrefix + normalized.replace(/^\w/, (c) => c.toUpperCase());
  }

  if (capitalize) {
    return normalized.replace(/^\w/, (c) => c.toUpperCase());
  }

  return normalized;
}
