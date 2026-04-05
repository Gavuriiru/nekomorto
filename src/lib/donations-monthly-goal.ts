export const MONTHLY_GOAL_MILESTONES = [25, 50, 75, 100] as const;

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
});

const formatGroupedInteger = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const sanitizeAmountValue = (value: string | undefined) => {
  const rawValue = String(value || "").trim();
  if (rawValue.includes("-")) {
    return "";
  }
  return rawValue.replace(/[R$\s]/g, "").replace(/[^\d.,]/g, "");
};

const resolveAmountParts = (value: string | undefined) => {
  const sanitized = sanitizeAmountValue(value);
  if (!sanitized) {
    return null;
  }

  const lastCommaIndex = sanitized.lastIndexOf(",");
  const lastDotIndex = sanitized.lastIndexOf(".");
  const decimalIndex = Math.max(lastCommaIndex, lastDotIndex);
  const hasTrailingSeparator = /[.,]$/.test(sanitized);

  let hasDecimal = decimalIndex >= 0;
  if (hasDecimal) {
    const rawFraction = sanitized.slice(decimalIndex + 1);
    const sanitizedFraction = rawFraction.replace(/[.,]/g, "");
    if (sanitizedFraction.length > 2 || /[.,]/.test(rawFraction)) {
      hasDecimal = false;
    }
  }

  const integerSource = hasDecimal ? sanitized.slice(0, decimalIndex) : sanitized;
  const fractionDigits = hasDecimal
    ? sanitized
        .slice(decimalIndex + 1)
        .replace(/[.,]/g, "")
        .slice(0, 2)
    : "";

  const rawIntegerDigits = integerSource.replace(/[.,]/g, "");
  const integerDigits =
    rawIntegerDigits === ""
      ? "0"
      : rawIntegerDigits.replace(/^0+(?=\d)/, "") || "0";

  return {
    hasDecimal,
    hasTrailingSeparator,
    integerDigits,
    fractionDigits,
  };
};

export const normalizeMonthlyGoalAmountInput = (
  value: string | undefined,
  options?: {
    finalize?: boolean;
  },
) => {
  const parts = resolveAmountParts(value);
  if (!parts) {
    return "";
  }

  const finalize = options?.finalize === true;
  const groupedInteger = formatGroupedInteger(parts.integerDigits);

  if (!parts.hasDecimal) {
    return groupedInteger;
  }

  let fractionDigits = parts.fractionDigits;
  if (finalize && fractionDigits.length > 0) {
    fractionDigits = fractionDigits.padEnd(2, "0");
  }

  if (!fractionDigits) {
    return finalize ? groupedInteger : `${groupedInteger},`;
  }

  return `${groupedInteger},${fractionDigits}`;
};

export const finalizeMonthlyGoalAmountInput = (value: string | undefined) =>
  normalizeMonthlyGoalAmountInput(value, { finalize: true });

export const parseMonthlyGoalAmount = (value: string | undefined) => {
  const normalized = finalizeMonthlyGoalAmountInput(value);
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const formatMonthlyGoalAmount = (value: number) =>
  brlFormatter.format(value > 0 ? value : 0);

export const sanitizeMonthlyGoalSupportersInput = (value: string | undefined) => {
  const rawValue = String(value || "").trim();
  if (rawValue.includes("-")) {
    return "";
  }
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return digits.replace(/^0+(?=\d)/, "") || "0";
};

export const parseMonthlyGoalSupporters = (value: string | undefined) => {
  const normalized = sanitizeMonthlyGoalSupportersInput(value);
  if (!normalized) {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

export const getMonthlyGoalTitle = (date = new Date()) => {
  const month = monthFormatter.format(date).toLocaleLowerCase("pt-BR");
  return `Meta de ${month}/${date.getFullYear()}`;
};

export const buildMonthlyGoalSummary = ({
  raised,
  target,
  supporters,
  note,
  date = new Date(),
}: {
  raised: string | undefined;
  target: string | undefined;
  supporters?: string | undefined;
  note?: string | undefined;
  date?: Date;
}) => {
  const raisedValue = parseMonthlyGoalAmount(raised);
  const targetValue = parseMonthlyGoalAmount(target);

  if (targetValue <= 0) {
    return null;
  }

  const percentage = Math.min(100, Math.max(0, Math.round((raisedValue / targetValue) * 100)));
  const remainingValue = Math.max(targetValue - raisedValue, 0);
  const supportersCount = parseMonthlyGoalSupporters(supporters);
  const title = getMonthlyGoalTitle(date);
  const raisedLabel = formatMonthlyGoalAmount(raisedValue);
  const targetLabel = formatMonthlyGoalAmount(targetValue);
  const remainingLabel = formatMonthlyGoalAmount(remainingValue);
  const isComplete = raisedValue >= targetValue;
  const supportersLabel =
    supportersCount > 0
      ? `${supportersCount} ${supportersCount === 1 ? "apoiador" : "apoiadores"} no mês`
      : "";
  const trimmedNote = String(note || "").trim();
  const statusText = isComplete
    ? "Meta do mês concluída!"
    : `Faltam ${remainingLabel} para bater a meta`;
  const progressLabel = `${title}: ${raisedLabel} arrecadados de ${targetLabel} (${percentage}%).`;

  return {
    title,
    raisedValue,
    targetValue,
    remainingValue,
    percentage,
    raisedLabel,
    targetLabel,
    remainingLabel,
    supportersCount,
    supportersLabel,
    note: trimmedNote,
    isComplete,
    statusText,
    progressLabel,
  };
};
