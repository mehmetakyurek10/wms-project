import { useState } from "react";
import { KeyRound } from "lucide-react";
import { changePassword } from "../api/passwordApi";
import { useToast } from "../context/ToastContext";

const MIN_LENGTH = 6;

function ChangePassword() {
  const bildir = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const submit = async (e) => {
    e.preventDefault();

    if (newPassword.length < MIN_LENGTH) {
      bildir(`Yeni şifre en az ${MIN_LENGTH} karakter olmalıdır`, "hata");
      return;
    }

    if (newPassword !== confirmPassword) {
      bildir("Yeni şifreler eşleşmiyor", "hata");
      return;
    }

    if (newPassword === currentPassword) {
      bildir("Yeni şifre mevcut şifreyle aynı olamaz", "hata");
      return;
    }

    setSaving(true);
    try {
      const response = await changePassword({ currentPassword, newPassword });
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
      }
      bildir("Şifreniz güncellendi");
      reset();
    } catch (err) {
      bildir(err.response?.data?.hata || "Şifre değiştirilemedi", "hata");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Şifre Değiştir</h2>

      <form onSubmit={submit} className="dar-form">
        <div className="form-alan">
          <label>Mevcut Şifre</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="form-alan">
          <label>Yeni Şifre</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="form-alan">
          <label>Yeni Şifre (Tekrar)</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <button type="submit" disabled={saving}>
          <KeyRound size={16} />
          {saving ? "Kaydediliyor..." : "Şifreyi Değiştir"}
        </button>
      </form>
    </div>
  );
}

export default ChangePassword;
