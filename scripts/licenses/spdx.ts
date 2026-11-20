// A license as a POM declares it: a free name and a URL, which publishers spell in many ways.
export type PomLicense = { readonly name: string; readonly url: string };

const KNOWN: readonly { id: string; name: RegExp; url: RegExp }[] = [
  {
    id: 'Apache-2.0',
    name: /^(the )?apache([ -]software)?([ -]license)?,?([ -]version)?[ -]2(\.0)?$/i,
    url: /apache\.org\/licenses\/LICENSE-2\.0/i,
  },
  { id: 'MIT', name: /^(the )?mit( license)?$/i, url: /opensource\.org\/licenses?\/mit/i },
];

// The SPDX identifier of a POM's licenses, or null when one of them is unknown. Several
// licenses in a POM are read as a choice, as Maven does.
export function spdxOfPom(licenses: readonly PomLicense[]): string | null {
  if (licenses.length === 0) return null;
  const ids = licenses.map(
    (license) =>
      KNOWN.find((known) => known.name.test(license.name.trim()) || known.url.test(license.url))
        ?.id ?? null,
  );
  if (ids.some((id) => id === null)) return null;
  const unique = [...new Set(ids)];
  return unique.length === 1 ? (unique[0] ?? null) : `(${unique.join(' OR ')})`;
}
