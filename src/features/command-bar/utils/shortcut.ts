export function isOpenShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey">) {
  const key = event.key.toLowerCase();
  return key === "k" && (event.ctrlKey || event.metaKey);
}

export function isCloseShortcut(event: Pick<KeyboardEvent, "key">) {
  return event.key === "Escape";
}
