import path from 'path';

import camelcase from 'camelcase';
import { iriOrIriStem } from '..';

export function normalizeUrl(
  url: string,
  capitalize?: boolean,
  not?: string,
  prefixes?: any,
) {
  const urlObject = new URL(url);
  if (urlObject.pathname === '/') {
    return camelcase(urlObject.host);
  }
  let normalized = camelcase(
    urlObject.hash === ''
      ? path.parse(urlObject.pathname).name
      : urlObject.hash.replace(/#+/, ''),
  );
  if (not && normalized.toLowerCase() === not.toLowerCase()) {
    const namespaceUrl = url.replace(
      urlObject.hash === ''
        ? path.parse(urlObject.pathname).name
        : urlObject.hash,
      urlObject.hash ? '#' : '',
    );
    const namespacePrefix = Object.keys(prefixes).find(
      (key) => prefixes[key] === namespaceUrl,
    );
    normalized =
      namespacePrefix + normalized.replace(/^\w/, (c) => c.toUpperCase());
  }

  if (capitalize) {
    return normalized.replace(/^\w/, (c) => c.toUpperCase()).replace(/\W/g, '');
  }

  return normalized;
}

export const findDuplicateIdentifier = (
  values: string[],
  url: string,
): string | undefined => {
  return values.find((otherValue) => {
    const otherIri = iriOrIriStem(otherValue);
    return (
      normalizeUrl(otherIri, true) === normalizeUrl(url, true) &&
      otherIri !== url
    );
  });
};
