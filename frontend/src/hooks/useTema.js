import { useCallback, useEffect, useState } from "react";

function mevcutTema() {
  return document.documentElement.getAttribute("data-tema") || "dark";
}

function temaRenkleri() {
  const stil = getComputedStyle(document.documentElement);
  const oku = (ad) => stil.getPropertyValue(ad).trim();

  return {
    metin: oku("--renk-metin"),
    metinSoluk: oku("--renk-metin-soluk"),
    kenar: oku("--renk-kenar"),
    yuzey: oku("--renk-yuzey"),
  };
}

function useTema() {
  const [tema, setTema] = useState(mevcutTema);
  const [renkler, setRenkler] = useState(temaRenkleri);

  useEffect(() => {
    const gozlemci = new MutationObserver(() => {
      setTema(mevcutTema());
      setRenkler(temaRenkleri());
    });

    gozlemci.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-tema"],
    });

    return () => gozlemci.disconnect();
  }, []);

  const temaDegistir = useCallback(() => {
    const yeni = mevcutTema() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-tema", yeni);
    localStorage.setItem("tema", yeni);
  }, []);

  return { tema, renkler, temaDegistir };
}

export default useTema;
