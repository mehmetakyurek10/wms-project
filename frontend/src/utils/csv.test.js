import { describe, it, expect } from "vitest";
import { csvOlustur } from "./csv";

describe("csvOlustur", () => {
  it("alanlari noktali virgulle, satirlari CRLF ile ayirir", () => {
    const sonuc = csvOlustur(["Ad", "Adet"], [["Gemlik", 40]]);

    expect(sonuc).toBe("Ad;Adet\r\nGemlik;40");
  });

  it("noktali virgul iceren degeri tirnak icine alir", () => {
    const sonuc = csvOlustur(["Not"], [["kova; teneke"]]);

    expect(sonuc).toBe('Not\r\n"kova; teneke"');
  });

  it("tirnak iceren degerde tirnagi ikiler", () => {
    const sonuc = csvOlustur(["Not"], [['12" palet']]);

    expect(sonuc).toBe('Not\r\n"12"" palet"');
  });

  it("satir sonu iceren degeri tirnak icine alir", () => {
    const sonuc = csvOlustur(["Adres"], [["Sokak\nNo 5"]]);

    expect(sonuc).toBe('Adres\r\n"Sokak\nNo 5"');
  });

  it("null ve undefined degerleri bos hucre yazar", () => {
    const sonuc = csvOlustur(["A", "B"], [[null, undefined]]);

    expect(sonuc).toBe("A;B\r\n;");
  });

  it("kacis gerektirmeyen degeri tirnaklamaz", () => {
    const sonuc = csvOlustur(["Ad"], [["Zeytin"]]);

    expect(sonuc).toBe("Ad\r\nZeytin");
  });
});
