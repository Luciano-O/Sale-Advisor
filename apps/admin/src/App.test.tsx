import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";

describe("admin curation workspace", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/v1/admin/dashboard"))
          return Response.json({ pending: 2, partial: 1, failed: 0, offersByLabel: { boa: 3 } });
        return Response.json({ items: [] }, { status: url.endsWith("/messages") ? 201 : 200 });
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("asks for the key and keeps it only in sessionStorage", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /acesso administrativo/i })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/chave administrativa/i), "admin-secret");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(sessionStorage.getItem("sale-advisor-admin-key")).toBe("admin-secret");
    expect(localStorage.getItem("sale-advisor-admin-key")).toBeNull();
    expect(await screen.findByRole("heading", { name: /visão geral/i })).toBeInTheDocument();
  });

  it("submits a manual offer with the admin header", async () => {
    sessionStorage.setItem("sale-advisor-admin-key", "secret");
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /nova oferta/i }));
    await userEvent.type(screen.getByLabelText(/texto da oferta/i), "RTX 4060 8GB R$ 1.899 Pix");
    await userEvent.type(screen.getByLabelText(/domínio da loja/i), "shop.example");
    await userEvent.click(screen.getByRole("button", { name: /cadastrar oferta/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/admin/messages"),
        expect.objectContaining({ headers: expect.objectContaining({ "x-admin-key": "secret" }) })
      )
    );
    expect(await screen.findByText(/mensagem adicionada ao pipeline/i)).toBeInTheDocument();
  });

  it("previews valid and invalid import items before submitting", async () => {
    sessionStorage.setItem("sale-advisor-admin-key", "secret");
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /importar json/i }));
    const payload = JSON.stringify({
      schemaVersion: 1,
      source: { name: "Carga", kind: "import" },
      messages: [
        { text: "RX 7600 R$ 1.500", capturedAt: "2026-07-14T12:00:00.000Z" },
        { text: "", capturedAt: "invalid" }
      ]
    });
    fireEvent.change(screen.getByLabelText(/json de importação/i), { target: { value: payload } });
    await userEvent.click(screen.getByRole("button", { name: /validar e visualizar/i }));
    expect(screen.getByText(/1 item válido/i)).toBeInTheDocument();
    expect(screen.getByText(/1 item inválido/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /enviar lote/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/admin/imports"),
        expect.any(Object)
      )
    );
  });

  it("exposes every minimum curation area", async () => {
    sessionStorage.setItem("sale-advisor-admin-key", "secret");
    render(<App />);
    for (const name of [
      "Mensagens",
      "Ofertas",
      "Produtos e aliases",
      "Sources e stores",
      "Auditoria"
    ]) {
      await userEvent.click(screen.getByRole("button", { name }));
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});
