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

  it("formul karakteriyle baslayan hucreyi tek tirnakla etkisizlestirir", () => {
    const sonuc = csvOlustur(["Ad"], [['=HYPERLINK("http://kotu/","Tikla")']]);

    expect(sonuc).toBe('Ad\r\n"\'=HYPERLINK(""http://kotu/"",""Tikla"")"');
  });

  it("arti ve at isaretiyle baslayan hucreleri de kacirir", () => {
    const sonuc = csvOlustur(["A", "B"], [["+1234", "@SUM(A1)"]]);

    expect(sonuc).toBe("A;B\r\n'+1234;'@SUM(A1)");
  });

  it("negatif sayiyi bozmaz", () => {
    const sonuc = csvOlustur(["Fark"], [[-20]]);

    expect(sonuc).toBe("Fark\r\n-20");
  });

  it("negatif ondalikli sayiyi da bozmaz", () => {
    const sonuc = csvOlustur(["Fark"], [["-12.5"]]);

    expect(sonuc).toBe("Fark\r\n-12.5");
  });

  it("tire ile baslayan metni kacirir", () => {
    const sonuc = csvOlustur(["Not"], [["-100 TL indirim uygulandi"]]);

    expect(sonuc).toBe("Not\r\n'-100 TL indirim uygulandi");
  });

  it("sekme ile baslayan hucreyi kacirir", () => {
    const sonuc = csvOlustur(["Not"], [["\tgizli"]]);

    expect(sonuc).toBe("Not\r\n'\tgizli");
  });
});
