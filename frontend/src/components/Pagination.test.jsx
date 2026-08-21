import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "./Pagination";

describe("Pagination", () => {
  it("kayit sayisi sayfa boyutunu asmiyorsa hicbir sey cizmez", () => {
    const { container } = render(
      <Pagination sayfa={1} toplam={20} sayfaBoyutu={20} degisti={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("toplam sayfa sayisini ve kayit adedini gosterir", () => {
    render(
      <Pagination sayfa={2} toplam={45} sayfaBoyutu={20} degisti={() => {}} />,
    );

    expect(screen.getByText(/Sayfa 2 \/ 3/)).toBeInTheDocument();
    expect(screen.getByText(/Toplam 45 kayıt/)).toBeInTheDocument();
  });

  it("ilk sayfada Onceki dugmesi kapalidir", () => {
    render(
      <Pagination sayfa={1} toplam={45} sayfaBoyutu={20} degisti={() => {}} />,
    );

    expect(screen.getByRole("button", { name: "Önceki" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sonraki" })).toBeEnabled();
  });

  it("son sayfada Sonraki dugmesi kapalidir", () => {
    render(
      <Pagination sayfa={3} toplam={45} sayfaBoyutu={20} degisti={() => {}} />,
    );

    expect(screen.getByRole("button", { name: "Sonraki" })).toBeDisabled();
  });

  it("dugmeler komsu sayfa numarasiyla geri bildirir", async () => {
    const degisti = vi.fn();

    render(
      <Pagination sayfa={2} toplam={45} sayfaBoyutu={20} degisti={degisti} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    expect(degisti).toHaveBeenCalledWith(3);

    await userEvent.click(screen.getByRole("button", { name: "Önceki" }));
    expect(degisti).toHaveBeenCalledWith(1);
  });
});
