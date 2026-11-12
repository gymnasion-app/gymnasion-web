import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import Badge from "../Badge/Badge";
import Button from "../Button/Button";
import { stravaService } from "../../services/stravaService";
import { connectStravaWithPopup, STRAVA_STATUS_CHANGED } from "../../features/strava/connectWithPopup";
import { authError } from "../../utils/authError";
import type { StravaAtividade, StravaStatusResponse } from "../../types/strava";
import "./StravaModal.css";

interface StravaModalProps {
  onClose: () => void;
  onStatusChanged?: (status: StravaStatusResponse) => void;
}

function formatStravaDate(isoDate?: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

export default function StravaModal({ onClose, onStatusChanged }: StravaModalProps) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StravaStatusResponse | null>(null);
  const [activities, setActivities] = useState<StravaAtividade[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchStatus() {
      try {
        setLoading(true);
        const res = await stravaService.obterStatus();
        if (!active) return;
        setStatus(res);
        if (onStatusChanged) onStatusChanged(res);

        if (res.conectado && !res.expirado) {
          setLoadingActivities(true);
          try {
            const acts = await stravaService.listarAtividades(5);
            if (active) setActivities(acts);
          } catch {
            // Falha ao listar atividades não impede visualização de status
          } finally {
            if (active) setLoadingActivities(false);
          }
        }
      } catch {
        if (active) {
          setStatus({ conectado: false, expirado: false, mock: false });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchStatus();
    window.addEventListener(STRAVA_STATUS_CHANGED, fetchStatus);
    return () => {
      active = false;
      window.removeEventListener(STRAVA_STATUS_CHANGED, fetchStatus);
    };
  }, [onStatusChanged]);

  async function handleConnect() {
    try {
      setConnecting(true);
      await connectStravaWithPopup();
      toast.success("Conta Strava conectada com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível conectar ao Strava.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      setDisconnecting(true);
      await stravaService.desconectar();
      const newStatus: StravaStatusResponse = {
        conectado: false,
        expirado: false,
        atletaId: null,
        nomeAtleta: null,
        mock: false,
      };
      setStatus(newStatus);
      setActivities([]);
      setShowConfirmDisconnect(false);
      if (onStatusChanged) onStatusChanged(newStatus);
      toast.success("Conta Strava desconectada com sucesso.");
    } catch (err) {
      const parsed = authError(err, "Não foi possível desconectar a conta Strava.");
      toast.error(parsed.message);
    } finally {
      setDisconnecting(false);
    }
  }

  const isConnected = status?.conectado ?? false;
  const isExpired = status?.expirado ?? false;

  return (
    <WorkspaceDialog
      title="Integração com o Strava"
      description="Sincronize automaticamente os treinos gravados no seu relógio ou GPS com o Gymnasion."
      icon="/student-profile/imgIconActivity2.svg"
      onClose={onClose}
      busy={connecting || disconnecting}
      className="strava-modal"
    >
      <div className="strava-modal__content">
        {loading ? (
          <div className="strava-modal__loading">
            <div className="strava-modal__spinner" />
            <p>Consultando status da integração...</p>
          </div>
        ) : isConnected ? (
          <div className="strava-modal__connected-box">
            {/* Status Header */}
            <div className="strava-modal__status-header">
              <div className="strava-modal__athlete-info">
                <span className="strava-modal__strava-logo-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#fc5200">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                  </svg>
                </span>
                <div>
                  <div className="strava-modal__athlete-title">
                    <strong>{status?.nomeAtleta || "Atleta Strava"}</strong>
                    <Badge tone={isExpired ? "warning" : "success"}>
                      {isExpired ? "Reconexão pendente" : "Conectado"}
                    </Badge>
                  </div>
                  {status?.atletaId && (
                    <span className="strava-modal__athlete-id">ID Strava: {status.atletaId}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Aviso de expiração se aplicável */}
            {isExpired && (
              <div className="strava-modal__alert-expired" role="alert">
                <strong>Conexão expirada</strong>
                <p>
                  Sua permissão no Strava expirou ou foi revogada. Reconecte sua conta para continuar
                  importando dados das suas atividades.
                </p>
                <Button
                  onClick={handleConnect}
                  loading={connecting}
                  className="strava-modal__btn-reconnect"
                >
                  Reconectar com o Strava
                </Button>
              </div>
            )}

            {/* Explicação de funcionamento */}
            <div className="strava-modal__features-note">
              <p>
                <strong>Importação ativa:</strong> Ao finalizar uma sessão planejada, você
                poderá selecionar sua atividade correspondente do Strava para preencher
                automaticamente métricas como distância, ritmo, tempo e frequência cardíaca.
              </p>
            </div>

            {/* Atividades recentes */}
            {!isExpired && (
              <div className="strava-modal__activities-section">
                <h3>Últimas atividades sincronizáveis</h3>
                {loadingActivities ? (
                  <p className="strava-modal__muted-text">Carregando atividades recentes...</p>
                ) : activities.length === 0 ? (
                  <p className="strava-modal__muted-text">
                    Nenhuma atividade recente encontrada no seu perfil Strava.
                  </p>
                ) : (
                  <div className="strava-modal__activities-list">
                    {activities.map((act) => (
                      <div key={act.id} className="strava-modal__activity-item">
                        <div className="strava-modal__activity-main">
                          <span className="strava-modal__activity-sport">
                            {act.esporte || act.tipo}
                          </span>
                          <strong>{act.nome}</strong>
                          <span className="strava-modal__activity-date">
                            {formatStravaDate(act.data)}
                          </span>
                        </div>
                        <div className="strava-modal__activity-stats">
                          {act.distanciaFormatada && (
                            <span className="strava-modal__stat-pill">
                              {act.distanciaFormatada}
                            </span>
                          )}
                          {act.tempoFormatado && (
                            <span className="strava-modal__stat-pill">
                              {act.tempoFormatado}
                            </span>
                          )}
                          {act.ritmoMedio && (
                            <span className="strava-modal__stat-pill">
                              {act.ritmoMedio}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ações de Desconexão */}
            <div className="strava-modal__disconnect-area">
              {showConfirmDisconnect ? (
                <div className="strava-modal__confirm-disconnect">
                  <p>Tem certeza de que deseja desconectar sua conta do Strava?</p>
                  <div className="strava-modal__confirm-actions">
                    <Button
                      variant="secondary"
                      disabled={disconnecting}
                      onClick={() => setShowConfirmDisconnect(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="danger"
                      loading={disconnecting}
                      onClick={handleDisconnect}
                    >
                      Confirmar desconexão
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="strava-modal__link-disconnect"
                  onClick={() => setShowConfirmDisconnect(true)}
                  disabled={disconnecting}
                >
                  Desconectar conta Strava
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Não Conectado */
          <div className="strava-modal__unconnected-box">
            <div className="strava-modal__hero">
              <div className="strava-modal__hero-icon">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="#fc5200">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                </svg>
              </div>
              <h3>Conecte seus treinos com o Strava</h3>
              <p>
                Vincule sua conta para que as corridas, pedais e natação gravados no seu relógio ou
                smartphone preencham automaticamente as métricas dos treinos passados pelo seu
                personal trainer.
              </p>
            </div>

            <div className="strava-modal__benefits">
              <div className="strava-modal__benefit-item">
                <span className="strava-modal__benefit-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fc5200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </span>
                <div>
                  <strong>Preenchimento automático inteligente</strong>
                  <p>
                    Distância, tempo, ritmo, frequência cardíaca, potência e cadência são inseridos com
                    um clique.
                  </p>
                </div>
              </div>
              <div className="strava-modal__benefit-item">
                <span className="strava-modal__benefit-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </span>
                <div>
                  <strong>Compatível com todas as modalidades</strong>
                  <p>
                    Válido para Corrida, Ciclismo, Natação, Treino Funcional e outras atividades do
                    Strava.
                  </p>
                </div>
              </div>
              <div className="strava-modal__benefit-item">
                <span className="strava-modal__benefit-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <div>
                  <strong>Privacidade e segurança</strong>
                  <p>
                    Apenas leitura das atividades públicas e privadas para preenchimento de métricas.
                    Você pode desconectar a qualquer momento.
                  </p>
                </div>
              </div>
            </div>

            <div className="strava-modal__connect-action">
              <button
                type="button"
                className="strava-modal__btn-strava"
                onClick={handleConnect}
                disabled={connecting}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff" aria-hidden="true">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                </svg>
                <span>{connecting ? "Aguardando autorização..." : "Conectar com o Strava"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="workspace-dialog__actions">
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </footer>
    </WorkspaceDialog>
  );
}
