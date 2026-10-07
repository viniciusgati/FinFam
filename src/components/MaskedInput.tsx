"use client";

import { maskDate, maskMonth } from "@/lib/mask";

export type InputMaskKind = "month" | "date";

export interface MaskedInputProps {
  /** Formato da máscara: competência `AAAA-MM` ou data `DD/MM/AAAA`. */
  mask: InputMaskKind;
  /** Valor já mascarado, mantido pelo componente pai. */
  value: string;
  /** Recebe o valor já mascarado (separadores inseridos automaticamente). */
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Input de texto (`inputMode="numeric"`) que aplica a máscara compartilhada
 * de competência ou data antes de repassar o valor ao componente pai, de modo
 * que o usuário digite apenas dígitos.
 */
export default function MaskedInput({
  mask,
  value,
  onChange,
  ...inputProps
}: MaskedInputProps) {
  const applyMask = mask === "month" ? maskMonth : maskDate;

  return (
    <input
      {...inputProps}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(applyMask(event.target.value))}
    />
  );
}
