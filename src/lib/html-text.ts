export const extractPlainTextFromHtml = (
  value: string | null | undefined,
  { preserveLineBreaks = false }: { preserveLineBreaks?: boolean } = {},
) => {
  const input = String(value ?? "");
  if (!input) {
    return "";
  }
  if (typeof DOMParser === "undefined") {
    return input.trim();
  }
  const document = new DOMParser().parseFromString(input, "text/html");
  if (preserveLineBreaks) {
    document.querySelectorAll("br").forEach((node) => {
      node.replaceWith("\n");
    });
    document
      .querySelectorAll("p,div,section,article,blockquote,li,h1,h2,h3,h4,h5,h6,pre,table,tr")
      .forEach((node) => {
        node.append(document.createTextNode("\n"));
      });
  }
  const rawText = String(document.body.textContent || "");
  if (!preserveLineBreaks) {
    return rawText.replace(/\s+/g, " ").trim();
  }
  return rawText
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
