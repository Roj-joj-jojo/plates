// Verify absence through the listing API supported by the local Storage server.
// An API error is never treated as proof that an object is absent.
export async function storageObjectExists(storage, path) {
  const separator = path.lastIndexOf("/");
  const prefix = separator < 0 ? "" : path.slice(0, separator);
  const name = path.slice(separator + 1);
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await storage.list(prefix, { limit: 100, offset, search: name });
    if (error) throw error;
    if ((data ?? []).some((object) => object.name === name && object.id)) return true;
    if ((data ?? []).length < 100) return false;
  }
}
