/**
 * "Erase everything": leave the screen only when the erase actually happened. If saving the empty data failed
 * the old data is still there, so the user stays on Profile (where the storage error is shown) and can retry.
 */
export async function eraseThenLeave(reset: () => Promise<boolean>, leave: () => void): Promise<boolean> {
  const ok = await reset();
  if (ok) leave();
  return ok;
}
