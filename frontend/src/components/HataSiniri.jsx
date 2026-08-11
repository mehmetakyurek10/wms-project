import { Component } from "react";

class HataSiniri extends Component {
  constructor(props) {
    super(props);
    this.state = { hata: null };
  }

  static getDerivedStateFromError(hata) {
    return { hata };
  }

  componentDidCatch(hata) {
    console.error("[arayuz] yakalanmamis hata:", hata);
  }

  render() {
    if (!this.state.hata) return this.props.children;

    // Tembel yuklenen bir sayfa paketi indirilemediginde bu hata olusuyor.
    // En sik sebebi, yeni surum yayinlandiktan sonra acik kalmis bir
    // sekmenin artik var olmayan dosya adini istemesi.
    const paketHatasi =
      /dynamically imported module|Loading chunk|Failed to fetch/i.test(
        this.state.hata?.message || "",
      );

    return (
      <div className="bos-durum">
        <strong>
          {paketHatasi ? "Yeni sürüm yayınlanmış" : "Bir şeyler ters gitti"}
        </strong>
        <p className="kucuk-not">
          {paketHatasi
            ? "Uygulama güncellenmiş. Sayfayı yenileyerek devam edebilirsiniz."
            : "Sayfayı yenileyin. Sorun sürerse yöneticinize bildirin."}
        </p>
        <button onClick={() => window.location.reload()}>Sayfayı Yenile</button>
      </div>
    );
  }
}

export default HataSiniri;
