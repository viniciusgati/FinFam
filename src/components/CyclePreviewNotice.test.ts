import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CyclePreviewNotice from "./CyclePreviewNotice";

describe("CyclePreviewNotice", () => {
  it("explica que os números são previsão do ciclo que ainda não começou", () => {
    const html = renderToStaticMarkup(createElement(CyclePreviewNotice));

    expect(html).toContain("Ciclo futuro");
    expect(html).toContain(
      "Este ciclo ainda não começou. Os números abaixo são uma previsão com o que já está lançado: rendas, contas fixas e faturas.",
    );
    expect(html).toContain('role="status"');
  });
});
