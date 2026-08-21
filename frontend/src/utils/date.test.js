import { describe, it, expect } from "vitest";
import { yerelTarih } from "./date";

describe("yerelTarih", () => {
  it("tarihi YYYY-AA-GG bicimine cevirir", () => {
    expect(yerelTarih(new Date(2026, 7, 21))).toBe("2026-08-21");
  });

  it("tek haneli ay ve gunu sifirla doldurur", () => {
    expect(yerelTarih(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("gece yarisina yakin saatte gunu kaydirmaz", () => {
    const gece = new Date(2026, 7, 21, 23, 30);

    expect(yerelTarih(gece)).toBe("2026-08-21");
  });
});
