import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import {
  createShoppingItem,
  deleteShoppingItem,
  getShoppingItem,
  loadActiveShoppingItems,
  updateShoppingItem,
} from "./shopping-items";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

// 2026-11-23 02:30 UTC ainda é 2026-11-22 23:30 em São Paulo (UTC-3).
const LATE_NIGHT_IN_SAO_PAULO = new Date("2026-11-23T02:30:00.000Z");

beforeEach(async () => {
  await resetDatabase();
  delete process.env.FINFAM_TIME_ZONE;
});

afterAll(async () => {
  await disconnectTestDatabase();
});

describe("shopping items — integração com PostgreSQL", () => {
  it("persiste item com addedOn padrão no fuso da família", async () => {
    const item = await createShoppingItem(
      { name: "Leite", kind: "ESSENCIAL", quantity: 2 },
      LATE_NIGHT_IN_SAO_PAULO,
    );

    expect(item.addedOn).toBe("2026-11-22");

    const row = await prisma.shoppingItem.findUnique({ where: { id: item.id } });
    expect(row?.addedOn).toBe("2026-11-22");
    expect(row?.kind).toBe("ESSENCIAL");
    expect(row?.quantity).toBe(2);
    expect(row?.purchased).toBe(false);
  });

  it("respeita o fuso configurado por FINFAM_TIME_ZONE", async () => {
    process.env.FINFAM_TIME_ZONE = "Asia/Tokyo";

    const item = await createShoppingItem(
      { name: "Arroz", kind: "ESSENCIAL" },
      LATE_NIGHT_IN_SAO_PAULO,
    );

    // 02:30 UTC já é 11:30 de 2026-11-23 em Tóquio.
    expect(item.addedOn).toBe("2026-11-23");
  });

  it("lê preço 0 ou ausente como null (sem preço)", async () => {
    const zero = await createShoppingItem({
      name: "Café",
      kind: "DESEJAVEL",
      estimatedUnitPriceCents: 0,
    });
    const absent = await createShoppingItem({
      name: "Chá",
      kind: "DESEJAVEL",
    });

    expect(zero.estimatedUnitPriceCents).toBeNull();
    expect(absent.estimatedUnitPriceCents).toBeNull();

    const persisted = await prisma.shoppingItem.findUnique({
      where: { id: zero.id },
    });
    expect(persisted?.estimatedUnitPriceCents).toBe(0);
  });

  it("update altera o preço sem tocar em addedOn e marca comprado com purchasedAt", async () => {
    const item = await createShoppingItem({
      name: "Sabão",
      kind: "ESSENCIAL",
      addedOn: "2026-11-01",
    });

    const updated = await updateShoppingItem(
      item.id,
      { name: "Sabão em pó", estimatedUnitPriceCents: 1234 },
      LATE_NIGHT_IN_SAO_PAULO,
    );

    expect(updated?.name).toBe("Sabão em pó");
    expect(updated?.estimatedUnitPriceCents).toBe(1234);
    expect(updated?.addedOn).toBe("2026-11-01");

    const purchasedAt = new Date("2026-11-24T12:00:00.000Z");
    const purchased = await updateShoppingItem(
      item.id,
      { purchased: true },
      purchasedAt,
    );

    expect(purchased?.purchased).toBe(true);
    expect(purchased?.purchasedAt).toEqual(purchasedAt);
    expect(purchased?.addedOn).toBe("2026-11-01");
  });

  it("ordena essenciais primeiro e exclui comprados da lista ativa", async () => {
    const desired = await createShoppingItem({
      name: "Café especial",
      kind: "DESEJAVEL",
      addedOn: "2026-11-01",
    });
    const essentialOld = await createShoppingItem({
      name: "Feijão",
      kind: "ESSENCIAL",
      addedOn: "2026-11-02",
    });
    const essentialNew = await createShoppingItem({
      name: "Arroz",
      kind: "ESSENCIAL",
      addedOn: "2026-11-10",
    });
    const essentialSameDay = await createShoppingItem({
      name: "Açúcar",
      kind: "ESSENCIAL",
      addedOn: "2026-11-10",
    });
    const purchased = await createShoppingItem({
      name: "Óleo",
      kind: "ESSENCIAL",
      addedOn: "2026-11-01",
    });
    await updateShoppingItem(purchased.id, { purchased: true });

    const active = await loadActiveShoppingItems();

    expect(active.map((item) => item.name)).toEqual([
      "Feijão",
      "Açúcar",
      "Arroz",
      "Café especial",
    ]);
    expect(active.map((item) => item.id)).toEqual([
      essentialOld.id,
      essentialSameDay.id,
      essentialNew.id,
      desired.id,
    ]);
  });

  it("getShoppingItem devolve null para id inexistente e delete remove o item", async () => {
    expect(await getShoppingItem("nao-existe")).toBeNull();
    expect(await updateShoppingItem("nao-existe", { name: "X" })).toBeNull();
    expect(await deleteShoppingItem("nao-existe")).toBe(false);

    const item = await createShoppingItem({ name: "Pão", kind: "ESSENCIAL" });
    expect(await deleteShoppingItem(item.id)).toBe(true);
    expect(await getShoppingItem(item.id)).toBeNull();
  });

  it("resetDatabase limpa shopping_items entre casos", async () => {
    await createShoppingItem({ name: "Manteiga", kind: "ESSENCIAL" });
    expect(await prisma.shoppingItem.count()).toBe(1);

    await resetDatabase();

    expect(await prisma.shoppingItem.count()).toBe(0);
  });
});
