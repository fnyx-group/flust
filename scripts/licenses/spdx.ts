// A license as a POM declares it: a free name and a URL, which publishers spell in many ways.
export type PomLicense = { readonly name: string; readonly url: string };

// Each URL matches whole: an optional http or https and www, the host and path, an optional .txt
// or .html and trailing slash, and nothing else, so that a URL that only contains it, on another
// host or under another path, is not read as that license.
const KNOWN: readonly { id: string; name: RegExp; url: RegExp }[] = [
  {
    id: 'Apache-2.0',
    name: /^(the )?apache([ -]software)?([ -]license)?,?([ -]version)?[ -]2(\.0)?$/i,
    url: /^(https?:\/\/)?(www\.)?apache\.org\/licenses\/LICENSE-2\.0(\.txt|\.html)?\/?$/i,
  },
  {
    id: 'MIT',
    name: /^(the )?mit( license)?$/i,
    url: /^(https?:\/\/)?(www\.)?opensource\.org\/licenses\/MIT(\.txt|\.html)?\/?$/i,
  },
];

// The license a POM entry names, read from its name alone: a URL to a known license text says
// nothing of what a name such as "Apache 2.0 with Commons Clause" adds to it. A URL that points to
// another known license than the name contradicts it, and the entry is read as unknown.
function spdxOfLicense(license: PomLicense): string | null {
  const named = KNOWN.find((known) => known.name.test(license.name.trim()));
  if (named === undefined) return null;
  const linked = KNOWN.find((known) => known.url.test(license.url.trim()));
  if (linked !== undefined && linked.id !== named.id) return null;
  return named.id;
}

// The SPDX identifier of a POM's licenses, or null when one of them is unknown. Several
// licenses in a POM are read as a choice, as Maven does.
export function spdxOfPom(licenses: readonly PomLicense[]): string | null {
  if (licenses.length === 0) return null;
  const ids = licenses.map(spdxOfLicense);
  if (ids.some((id) => id === null)) return null;
  const unique = [...new Set(ids)];
  return unique.length === 1 ? (unique[0] ?? null) : `(${unique.join(' OR ')})`;
}
