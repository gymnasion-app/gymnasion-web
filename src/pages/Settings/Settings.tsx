import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Bell, Camera, Mail, Smartphone, User, KeyRound } from "lucide-react";
import SettingsSection from "../../components/SettingsSection/SettingsSection";
import Avatar from "../../components/Avatar/Avatar";
import Button from "../../components/Button/Button";
import Checkbox from "../../components/Checkbox/Checkbox";
import FormField from "../../components/FormField/FormField";
import WorkspaceDialog from "../../components/WorkspaceDialog/WorkspaceDialog";
import { useAccountSettings } from "../../features/settings/useAccountSettings";
import { accountService } from "../../services/accountService";
import { authError } from "../../utils/authError";
import { formatPhone, passwordRules } from "../SignUp/validation";
import type { UsuarioPerfilResponse } from "../../types/account";
import "./Settings.css";

function formatCpf(cpf?: string | null): string {
  if (!cpf) return "—";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

export default function Settings() {
  const { settings, save } = useAccountSettings();
  const [draft, setDraft] = useState(settings);
  const [reading, setReading] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // Perfil do usuário logado
  const [profile, setProfile] = useState<UsuarioPerfilResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Modal: Editar dados cadastrais
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editProfileError, setEditProfileError] = useState("");

  // Modal: Alterar senha
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    let active = true;
    setLoadingProfile(true);
    accountService
      .obterPerfil()
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setEditName(data.nome);
        setEditPhone(formatPhone(data.celular));
      })
      .catch((err) => {
        if (!active) return;
        setError(authError(err, "Não foi possível carregar os dados cadastrais.").message);
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const changed =
    draft.photo !== settings.photo ||
    draft.showNotificationBadge !== settings.showNotificationBadge ||
    draft.notificacoesEmail !== settings.notificacoesEmail ||
    draft.notificacoesPush !== settings.notificacoesPush;

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError("Escolha uma imagem JPG, PNG ou WebP de até 2 MB.");
      return;
    }
    setReading(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      const size = Math.min(image.width, image.height);
      context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
      const photo = canvas.toDataURL("image/png");
      setDraft((previous) => ({ ...previous, photo }));
    } catch {
      setError("Não foi possível abrir essa imagem. Escolha outro arquivo.");
    } finally {
      URL.revokeObjectURL(url);
      setReading(false);
    }
  }

  async function saveSettings() {
    setError("");
    setMessage("");
    setSavingPrefs(true);
    try {
      await save(draft);
      setMessage("Preferências sincronizadas com sua conta.");
      toast.success("Preferências salvas com sucesso!");
    } catch (err) {
      const errMsg = authError(err, "Não foi possível salvar as preferências.").message;
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    setEditProfileError("");
    if (!editName.trim()) {
      setEditProfileError("O nome é obrigatório.");
      return;
    }
    if (!editPhone.trim()) {
      setEditProfileError("O celular é obrigatório.");
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await accountService.atualizarPerfil({
        nome: editName.trim(),
        celular: editPhone.trim(),
      });
      setProfile(updated);
      setEditProfileOpen(false);
      toast.success("Dados cadastrais atualizados com sucesso!");
    } catch (err) {
      setEditProfileError(authError(err, "Não foi possível atualizar os dados cadastrais.").message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setChangePasswordError("");

    if (!currentPassword) {
      setChangePasswordError("Informe a senha atual.");
      return;
    }
    if (!newPassword) {
      setChangePasswordError("Informe a nova senha.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError("A confirmação da nova senha não coincide com a nova senha.");
      return;
    }
    if (!passwordRules.every((rule) => rule.test(newPassword))) {
      setChangePasswordError(
        "A senha deve conter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula, número e caractere especial."
      );
      return;
    }

    setSavingPassword(true);
    try {
      const res = await accountService.alterarSenha({
        senhaAtual: currentPassword,
        novaSenha: newPassword,
        confirmacaoNovaSenha: confirmPassword,
      });
      setChangePasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(res.mensagem || "Senha alterada com sucesso!");
    } catch (err) {
      setChangePasswordError(authError(err, "Não foi possível alterar a senha.").message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="settings-page">
      <p className="settings-page__notice">
        Suas preferências e dados de perfil são sincronizados na nuvem para a sua conta Gymnasion.
      </p>

      <div className="settings-page__grid">
        <div className="settings-page__sections">
          {/* Seção: Imagem de perfil */}
          <SettingsSection
            title="Imagem de perfil"
            description="Personalize a imagem exibida no menu e no cabeçalho. Ela não será compartilhada com outros usuários."
          >
            <div className="settings-page__photo">
              <Avatar name={profile?.nome || "Minha conta"} src={draft.photo} className="settings-page__avatar" />
              <div>
                <div className="settings-page__buttons">
                  <Button icon={<Camera size={18} />} loading={reading} onClick={() => input.current?.click()}>
                    Escolher imagem
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!draft.photo || reading}
                    onClick={() => setDraft((previous) => ({ ...previous, photo: "" }))}
                  >
                    Remover
                  </Button>
                </div>
                <p>JPG, PNG ou WebP, até 2 MB. Recorte central quadrado.</p>
              </div>
            </div>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={choosePhoto} />
          </SettingsSection>

          {/* Seção: Notificações */}
          <SettingsSection title="Notificações" description="Escolha como deseja acompanhar as novidades e treinos.">
            <div className="settings-page__preference-group">
              <div className="settings-page__preference">
                <Bell size={22} />
                <div>
                  <Checkbox
                    label="Mostrar indicador de notificações não lidas"
                    checked={draft.showNotificationBadge}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, showNotificationBadge: event.target.checked }))
                    }
                  />
                  <p>Controla o contador e o ponto no sino. Você ainda poderá abrir e consultar todas as notificações.</p>
                </div>
              </div>

              <div className="settings-page__divider" />

              <div className="settings-page__preference">
                <Mail size={22} />
                <div>
                  <Checkbox
                    label="Notificações por e-mail"
                    checked={draft.notificacoesEmail}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, notificacoesEmail: event.target.checked }))
                    }
                  />
                  <p>Receba novidades, resumos e alertas de treinos diretamente na sua caixa de entrada.</p>
                </div>
              </div>

              <div className="settings-page__divider" />

              <div className="settings-page__preference">
                <Smartphone size={22} />
                <div>
                  <Checkbox
                    label="Notificações push"
                    checked={draft.notificacoesPush}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, notificacoesPush: event.target.checked }))
                    }
                  />
                  <p>Receba alertas e lembretes de sessões fora da página quando disponível no navegador.</p>
                </div>
              </div>
            </div>
          </SettingsSection>
        </div>

        {/* Seção: Conta e segurança */}
        <SettingsSection title="Conta e segurança" description="Gerencie seus dados cadastrais e o acesso à sua conta.">
          <div className="settings-page__profile-summary">
            <div className="settings-page__profile-row">
              <span className="settings-page__profile-label">Nome completo</span>
              <strong className="settings-page__profile-value">
                {loadingProfile ? "Carregando..." : profile?.nome || "—"}
              </strong>
            </div>

            <div className="settings-page__profile-row">
              <span className="settings-page__profile-label">E-mail</span>
              <span className="settings-page__profile-value">{profile?.email || "—"}</span>
            </div>

            <div className="settings-page__profile-row">
              <span className="settings-page__profile-label">CPF</span>
              <span className="settings-page__profile-value">{formatCpf(profile?.cpf)}</span>
            </div>

            <div className="settings-page__profile-row">
              <span className="settings-page__profile-label">Celular</span>
              <span className="settings-page__profile-value">{formatPhone(profile?.celular || "") || "—"}</span>
            </div>

            <div className="settings-page__profile-row">
              <span className="settings-page__profile-label">Tipo de conta</span>
              <span className="settings-page__profile-value">
                {profile?.role === "PERSONAL_TRAINER" ? "Personal Trainer" : "Aluno"}
              </span>
            </div>

            {profile?.modalidadePrincipal && (
              <div className="settings-page__profile-row">
                <span className="settings-page__profile-label">Modalidade principal</span>
                <span className="settings-page__profile-value">{profile.modalidadePrincipal}</span>
              </div>
            )}

            {profile?.modalidadesAluno && profile.modalidadesAluno.length > 0 && (
              <div className="settings-page__profile-row">
                <span className="settings-page__profile-label">Modalidades</span>
                <span className="settings-page__profile-value">{profile.modalidadesAluno.join(", ")}</span>
              </div>
            )}
          </div>

          <div className="settings-page__security-actions">
            <Button
              variant="secondary"
              icon={<User size={16} />}
              onClick={() => {
                setEditProfileError("");
                setEditName(profile?.nome || "");
                setEditPhone(formatPhone(profile?.celular || ""));
                setEditProfileOpen(true);
              }}
            >
              Editar dados cadastrais
            </Button>

            <Button
              variant="secondary"
              icon={<KeyRound size={16} />}
              onClick={() => {
                setChangePasswordError("");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setChangePasswordOpen(true);
              }}
            >
              Alterar senha da conta
            </Button>
          </div>
        </SettingsSection>
      </div>

      <footer className="settings-page__footer">
        <div aria-live="polite">
          {message && <p className="settings-page__success">{message}</p>}
          {error && (
            <p role="alert" className="settings-page__error">
              {error}
            </p>
          )}
        </div>
        <div className="settings-page__buttons">
          <Button
            variant="secondary"
            disabled={!changed || reading || savingPrefs}
            onClick={() => {
              setDraft(settings);
              setError("");
              setMessage("");
            }}
          >
            Descartar alterações
          </Button>
          <Button disabled={!changed || reading} loading={savingPrefs} onClick={saveSettings}>
            Salvar preferências
          </Button>
        </div>
      </footer>

      {/* Modal: Editar Dados Cadastrais */}
      {editProfileOpen && (
        <WorkspaceDialog
          title="Editar dados cadastrais"
          description="Atualize seu nome completo e telefone de contato."
          tone="primary"
          onClose={() => setEditProfileOpen(false)}
          busy={savingProfile}
          actions={
            <>
              <Button variant="secondary" onClick={() => setEditProfileOpen(false)} disabled={savingProfile}>
                Cancelar
              </Button>
              <Button loading={savingProfile} onClick={handleSaveProfile}>
                Salvar alterações
              </Button>
            </>
          }
        >
          <form className="settings-dialog__form" onSubmit={handleSaveProfile}>
            {editProfileError && (
              <p role="alert" className="settings-page__error">
                {editProfileError}
              </p>
            )}

            <FormField
              id="edit-name"
              label="Nome completo"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={150}
              required
            />

            <FormField
              id="edit-phone"
              label="Telefone celular"
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(formatPhone(e.target.value))}
              placeholder="(11) 98765-4321"
              maxLength={15}
              required
            />

            <FormField
              id="edit-email"
              label="E-mail da conta"
              type="email"
              value={profile?.email || ""}
              disabled
              hint="O e-mail é o identificador único da conta e não pode ser alterado."
            />

            <FormField
              id="edit-cpf"
              label="CPF"
              type="text"
              value={formatCpf(profile?.cpf)}
              disabled
              hint="O CPF é único e vinculado à conta."
            />
          </form>
        </WorkspaceDialog>
      )}

      {/* Modal: Alterar Senha */}
      {changePasswordOpen && (
        <WorkspaceDialog
          title="Alterar senha"
          description="Defina uma nova senha para acessar sua conta."
          tone="primary"
          onClose={() => setChangePasswordOpen(false)}
          busy={savingPassword}
          actions={
            <>
              <Button variant="secondary" onClick={() => setChangePasswordOpen(false)} disabled={savingPassword}>
                Cancelar
              </Button>
              <Button loading={savingPassword} onClick={handleChangePassword}>
                Atualizar senha
              </Button>
            </>
          }
        >
          <form className="settings-dialog__form" onSubmit={handleChangePassword}>
            {changePasswordError && (
              <p role="alert" className="settings-page__error">
                {changePasswordError}
              </p>
            )}

            <FormField
              id="current-password"
              label="Senha atual"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              required
            />

            <FormField
              id="new-password"
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a nova senha"
              required
            />

            <div className="settings-dialog__password-rules">
              <span style={{ fontWeight: 600, color: "var(--color-ink-700)" }}>Requisitos de senha forte:</span>
              {passwordRules.map((rule) => {
                const passed = rule.test(newPassword);
                return (
                  <div key={rule.label} className={`settings-dialog__rule-item ${passed ? "is-valid" : ""}`}>
                    <span className="settings-dialog__rule-dot" />
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>

            <FormField
              id="confirm-password"
              label="Confirmar nova senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite a nova senha novamente"
              required
            />
          </form>
        </WorkspaceDialog>
      )}
    </div>
  );
}
