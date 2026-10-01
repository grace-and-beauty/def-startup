"use client";

import { Label } from "@/components/ui/label";

const HEX = /^#[0-9a-fA-F]{6}$/;

interface ColorFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/** Native color picker + hex value (card colors in onboarding and settings). */
export function ColorField({ id, name, label, value, error, onChange }: ColorFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={name}
          type="color"
          value={HEX.test(value) ? value.toLowerCase() : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <span className="text-muted-foreground hidden font-mono text-xs sm:inline">{value}</span>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
