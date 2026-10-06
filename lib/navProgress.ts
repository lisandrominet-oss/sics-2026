// Permite avisar a <NavProgress> que arrancó una navegación hecha por código (router.push).
export const NAV_START_EVENT = "sc:nav-start";

export function startNavProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NAV_START_EVENT));
}
