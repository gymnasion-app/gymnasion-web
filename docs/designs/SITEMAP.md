# Gymnasion — Índice de Especificações Técnicas (EGM / SDD)

Este diretório contém as especificações técnicas, decisões de arquitetura e documentos de design (Specs) da plataforma SaaS **Gymnasion**.

## 📌 Visão Geral do Sistema
O **Gymnasion** é um ecossistema SaaS para Personal Trainers gerenciarem carteiras de alunos, prescreverem rotinas de treinos com métricas customizadas, acompanharem a execução com RPE/auditoria e escalarem suas consultorias esportivas.

* **Backend:** Spring Boot (Java 21, PostgreSQL, Flyway, JWT, RFC 7807)
* **Frontend Web:** React + TypeScript + Tailwind CSS
* **Mobile App:** React Native + Expo Router + TypeScript

---

## 📑 Especificações e Decisões de Design (SDD)

| Documento | Escopo | Status | Data |
|---|---|---|---|
| [Autenticação e Sessão](../autenticacao.md) | Login, JWT, reCAPTCHA v2 e recuperação | Implementado | 2026-10-13 |
| [Portal do Aluno](../inicio-alunos.md) | Visualização de treinos, onboarding e dashboard do aluno | Implementado | 2026-10-14 |
| [Gestão de Rotinas](../rotinas.md) | Estrutura de semanas, exercícios e métricas | Implementado | 2026-10-16 |
| [Redesign do Perfil do Aluno (Rotina Ativa e Sessões)](./student-profile-redesign.md) | Seletor de múltiplas rotinas ativas, simplificação de chips de métricas, filtro de semanas compacto e compactação da tabela na Visão Geral (`StudentProfile`, `ProfileRoutineCard`, `ProfileSessions`, `profileModel`) | Aprovado | 2026-11-03 |
| [Suporte Full-Stack a Atleta Híbrido (Múltiplas Modalidades e Rotinas Ativas)](./hybrid-athlete.md) | Convite e perfil com 1 a 3 modalidades por aluno, bloqueio HTTP 422 ao remover modalidade com rotina/turma ativa, preservação de histórico, até 1 rotina ativa por modalidade e calendário semanal unificado por datas reais com filtro por modalidade | Implementado | 2026-11-11 |
| [Vínculo de Métricas Personalizadas por Sessão de Treino e Duplicação de Planejamento](./session-metrics-and-duplication.md) | Transferência do vínculo de métricas (`0..N`) de `RotinaTreino` para `SessaoTreino`, migração Flyway `V22` preservando histórico, ações de duplicar sessão e duplicar semana (`N -> N+1` com auto-expansão) e resumo derivado Macro vs. Micro (`RoutineSessionPlanner`, `NewRoutine`, `Routines`, `ProfileRoutineCard`, `StudentProfile`, `RotinaTreinoService`, `MetricaService`) | Implementado | 2026-11-11 |

---

## 🛠️ Fluxo de Revisão e Novas Features (EGM)
Para novas funcionalidades ou revisões arquiteturais:
1. **Brainstorming:** `/egm-brainstorm <ideia>`
2. **Elaboração da Spec:** `/egm-draft`
3. **Revisão Zero-Context:** `/egm-review docs/designs/<arquivo>.md`
4. **Verificação de Desvio:** `/egm-drift-report`
