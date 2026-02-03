export const formatDateTime = (value?: string | null, locale = "pt-BR") => {
  if (!value) return "";
  return new Date(value).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
};

export const formatDate = (value?: string | null, locale = "pt-BR") => {
  if (!value) return "";
  return new Date(value).toLocaleDateString(locale, { dateStyle: "short" });
};

export const formatDateTimeShort = (value?: string | null, locale = "pt-BR") => {
  if (!value) return "";
  return new Date(value).toLocaleString(locale);
};
