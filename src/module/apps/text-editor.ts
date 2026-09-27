export async function richTextEdit(doc: foundry.abstract.Document.Any, property: string): Promise<string | undefined> {
  // An unset field is a normal starting state -- treat it as empty rather than refusing to open
  const originalText = foundry.utils.getProperty(doc, property) ?? "";
  if (typeof originalText !== "string") throw new Error(`Document property ${property} is not a string`);
  const content = document.createElement("div");
  content.appendChild(
    // @ts-expect-error The missing stuff is definitely optional
    foundry.applications.elements.HTMLProseMirrorElement.create({
      name: "result",
      toggled: false,
      value: originalText,
    })
  );
  const { result }: { result?: string } =
    ((await foundry.applications.api.Dialog.input(<foundry.applications.api.Dialog.InputConfig>{
      id: `richEditor-${doc.uuid}-${property}`,
      content,
      classes: ["lancer", "rich-editor"],
      window: { resizable: true },
      position: { width: 550, height: 400 },
    })) as any) ?? {};
  return result;
}
