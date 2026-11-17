import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("metadata do layout raiz", () => {
  it("declara favicon para o browser não registrar 404 em /favicon.ico (regressão #373)", () => {
    const icons = metadata.icons as { icon?: string } | undefined;
    expect(icons?.icon).toBe("/icons/icon.svg");
  });
});
