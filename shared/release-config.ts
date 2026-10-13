// Enable only after the publisher has an Authenticode certificate and signed
// installer/update tests passed. Never permit unsigned automatic installation.
export const releaseConfig: { automaticUpdates: boolean; publisher: string | null } = {
  automaticUpdates: false, publisher: null
};
