import { useEffect, useMemo, useRef, useState } from "react";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import Button from "../Button/Button";
import ModalityMultiSelect, { type ModalityOptionItem } from "../ModalityMultiSelect/ModalityMultiSelect";
import { modalidadeService } from "../../services/modalidadeService";
import { personalTrainerService } from "../../services/personalTrainerService";
import { authError } from "../../utils/authError";
import type { Modalidade } from "../../types/modalidade";
import "./StudentInviteModal.css";

const MAX_MODALITIES = 3;

export default function StudentInviteModal({ onClose }: { onClose: () => void }) {
  const [modalities, setModalities] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [studentEmail, setStudentEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<{ url: string; expiresAt: number; emailEnviado?: string }>({ url: "", expiresAt: 0 });
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await modalidadeService.listarTodas();
      if (mounted.current) {
        const active = (data || [])
          .filter((item) => item.ativo !== false)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        setModalities(active);
      }
    } catch (err) {
      if (mounted.current) {
        setError(authError(err, "Não foi possível carregar as modalidades.").message);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, []);

  function toggleModality(id: number) {
    setError("");
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= MAX_MODALITIES) return prev;
      return [...prev, id];
    });
  }

  async function generate(customEmail?: string) {
    if (!selectedIds.length || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const started = Date.now();
    const emailTarget = customEmail !== undefined ? customEmail : studentEmail;
    try {
      const result = await personalTrainerService.gerarConvite(selectedIds, emailTarget);
      if (mounted.current) {
        setInvite({ url: result.url, expiresAt: started + 900000, emailEnviado: result.emailEnviado });
        setCopied(false);
        setNow(Date.now());
      }
    } catch (err) {
      if (mounted.current) {
        setError(authError(err, "Não foi possível gerar o convite.").message);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const remaining = Math.max(0, Math.ceil((invite.expiresAt - now) / 1000));

  const selectedChips = useMemo(
    () =>
      selectedIds
        .map((id) => modalities.find((m) => m.id === id))
        .filter((m): m is Modalidade => Boolean(m))
        .map((m) => ({ id: m.id, nome: m.nome })),
    [modalities, selectedIds]
  );

  const selectedNames = selectedChips.map((item) => item.nome).join(", ");

  const modalityOptions: ModalityOptionItem[] = useMemo(
    () =>
      modalities.map((item) => {
        const checked = selectedIds.includes(item.id);
        const limitReached = selectedIds.length >= MAX_MODALITIES && !checked;
        return {
          modalidade: item,
          checked,
          disabled: busy || limitReached,
        };
      }),
    [modalities, selectedIds, busy]
  );

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <WorkspaceDialog
      title={invite.url ? "Link gerado com sucesso!" : "Cadastrar aluno"}
      description={
        invite.url
          ? "Compartilhe o convite com seu aluno."
          : "Selecione até 3 modalidades para gerar um convite de cadastro."
      }
      icon={invite.url ? "/workspace/402-1230-imgIconLink.svg" : "/workspace/402-935-imgIconUserplus.svg"}
      tone={invite.url ? "success" : "primary"}
      wide
      className="invite-v2__dialog"
      busy={busy}
      onClose={onClose}
      actions={
        invite.url ? (
          <Button onClick={onClose}>Concluir</Button>
        ) : (
          <>
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button loading={busy} disabled={!selectedIds.length || loading} onClick={() => void generate()}>
              Gerar link
            </Button>
          </>
        )
      }
    >
      {!invite.url ? (
        <div className="invite-v2">
          <ModalityMultiSelect
            label="Modalidades do aluno"
            searchId="invite-modality-search"
            options={modalityOptions}
            selectedModalities={selectedChips}
            maxCount={MAX_MODALITIES}
            loading={loading}
            disabled={busy}
            onToggle={toggleModality}
            onRetry={() => void load()}
            scrollMaxHeight="clamp(156px, 26dvh, 204px)"
          />

          <p className="invite-v2__info" role="note">
            Você pode selecionar até 3 modalidades esportivas para o aluno. Caso precise adicionar ou alterar depois, você poderá editar no perfil do aluno.
          </p>

          <div className="invite-v2__email-field">
            <label htmlFor="invite-student-email">E-mail do aluno (opcional para envio direto)</label>
            <input
              id="invite-student-email"
              type="email"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="aluno@email.com"
              value={studentEmail}
              disabled={loading || busy}
              onChange={(event) => setStudentEmail(event.target.value)}
            />
          </div>

          <p className="invite-v2__note">
            <img src="/workspace/402-935-imgIconClock.svg" alt="" />
            O link expira em 15 minutos após ser gerado.
          </p>
        </div>
      ) : (
        <div className="invite-v2">
          <div className="invite-v2__email-field">
            <label htmlFor="invite-url">Link de convite</label>
            <div className="invite-v2__link">
              <input
                id="invite-url"
                readOnly
                value={invite.url}
                onFocus={(event) => event.target.select()}
              />
              <Button variant="secondary" disabled={!remaining} onClick={() => void copy()}>
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          </div>

          <p className="invite-v2__note" role="status">
            {remaining
              ? "Expira em " +
                Math.floor(remaining / 60).toString().padStart(2, "0") +
                ":" +
                (remaining % 60).toString().padStart(2, "0")
              : "Convite expirado"}{" "}
            · {selectedNames}
          </p>

          {!remaining && (
            <Button loading={busy} onClick={() => void generate()}>
              Gerar novo convite
            </Button>
          )}

          <div className="invite-v2__email">
            <strong>Envio por e-mail</strong>
            {invite.emailEnviado ? (
              <p style={{ color: "var(--color-primary-600)", fontWeight: 500, marginTop: "4px" }}>
                ✓ Convite enviado por e-mail para: <strong>{invite.emailEnviado}</strong>
              </p>
            ) : (
              <>
                <p style={{ margin: "4px 0 8px" }}>
                  Deseja enviar o link diretamente para o e-mail do aluno?
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="invite-student-email-after"
                    type="email"
                    autoComplete="email"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="send"
                    aria-label="E-mail do aluno"
                    placeholder="aluno@email.com"
                    value={studentEmail}
                    disabled={busy || !remaining}
                    onChange={(event) => setStudentEmail(event.target.value)}
                  />
                  <Button
                    variant="secondary"
                    disabled={!studentEmail.trim() || !remaining || busy}
                    loading={busy}
                    onClick={() => void generate(studentEmail.trim())}
                  >
                    Enviar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {error && (
        <p className="workspace-dialog__error" role="alert">
          {error}
        </p>
      )}
    </WorkspaceDialog>
  );
}
