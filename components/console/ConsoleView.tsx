"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Terminal } from "@/components/ui/Terminal";
import CIcon from "@coreui/icons-react";
import {
  cilArrowRight,
  cilCheckCircle,
  cilChatBubble,
  cilCommentSquare,
  cilInfo,
  cilMagnifyingGlass,
  cilMediaPlay,
  cilPlus,
  cilTrash,
  cilUser,
  cilWarning,
  cilXCircle,
} from "@coreui/icons";
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CFormTextarea,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import RunOutcome from "@/components/console/RunOutcome";
import { GAP, pageSlots } from "@/lib/pagination";
import { useT } from "@/lib/i18n";
import { conversationsApi, runsApi, toolsApi } from "@/lib/api/endpoints";
import {
  PAGE_SIZE,
  conversationsStore,
  useConversations,
} from "@/lib/api/conversations-store";
import { useTools } from "@/lib/api/tools-store";
import { notify } from "@/lib/ui/toast-store";
import { ApiRequestError, ApiUnreachableError } from "@/lib/api/errors";
import type {
  ConversationPayload,
  PlanWarning,
  ConversationTurnPayload,
  PlanPayload,
  PromptResultPayload,
} from "@/lib/api/types";

/**
 * Which conversation was open, remembered per browser.
 *
 * Only the reference: the conversation itself is on the server, where it belongs. This is
 * the difference between returning to the console and finding it where you left it, and
 * having to pick the same thread out of a list every time.
 */
const LAST_OPENED = "mcp-panel.console.conversation";

type Turn = {
  /** Local to this render, for a stable key. The server's turn id is on `saved`. */
  id: number;
  prompt: string;
  executed: boolean;
  /** The tool the operator pinned, if they pinned one. */
  chosen: string;
  /** Answered in this session: the whole routing result, plan and dispatch included. */
  result?: PromptResultPayload;
  /** Read back from the gateway: what was kept of a turn asked earlier. */
  saved?: ConversationTurnPayload;
  /**
   * The gateway's id for this turn, once it has answered.
   *
   * Needed to approve a step without reloading the conversation first: approving is done
   * by turn id, never by sending the command back.
   */
  turnId?: number;
  failure?: string;
};

/**
 * Told when a run in this console has finished.
 *
 * A finished run is the moment the goal loop may have written the next step, and there is
 * no channel from the gateway to a browser to announce it. Passed by context rather than
 * through four components that have no other use for it.
 */
const RunFinished = createContext<() => void>(() => {});

/**
 * How long to wait after the last keystroke before searching.
 *
 * Long enough that typing a table name is one request rather than eleven, short enough
 * that it still feels like the list is following along.
 */
const SEARCH_DELAY_MS = 300;

/**
 * How long to keep looking for a step the goal loop is still deciding on.
 *
 * The decision is a model call and takes seconds; asking once, at the instant the run
 * finished, is asking before there is an answer. Eight tries at two and a half seconds
 * covers the ones seen so far with room to spare, and a run that proposes nothing costs a
 * single request because the loop stops at the first thing it finds.
 */
const ABSORB_ATTEMPTS = 8;
const ABSORB_INTERVAL_MS = 2500;

/**
 * Ask for something in words and see what it would do.
 *
 * The chain behind one line of text is a model choosing a tool, then the ordinary planning
 * path deciding what that tool resolves to. They are kept apart on purpose: the second step
 * is the one with the guardrails, and routing a prompt must not become a way around them.
 *
 * Nothing runs unless the box below is ticked. Deciding what a request means and acting on
 * it are different things, and a console that did both at once would make the second one
 * invisible — which is the wrong property for a screen whose output is shell commands.
 *
 * The thread is kept by the gateway rather than by this component. It used to live in
 * React state and nowhere else, so leaving the page lost the question, the reasoning and
 * the plan together — and for a turn that was not executed there was no run either, which
 * is the commonest way the console is used.
 */
export default function ConsoleView() {
  const t = useT();
  const tools = useTools();
  const conversations = useConversations();
  const [prompt, setPrompt] = useState("");
  const [toolName, setToolName] = useState("");
  const [execute, setExecute] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const nextId = useRef(1);

  const open = useCallback(async (conversationRef: string) => {
    setRestoring(true);
    try {
      const conversation = await conversationsApi.get(conversationRef);

      setOpenRef(conversationRef);
      setTurns(
        (conversation.turns ?? []).map((saved) => ({
          id: nextId.current++,
          prompt: saved.prompt,
          executed: saved.executed,
          chosen: saved.pinnedTool ?? "",
          saved,
          failure: saved.failure ?? undefined,
        })),
      );
      remember(conversationRef);
    } catch {
      // Gone, or never the caller's. Either way the console must not sit pointing at it:
      // the next question would be appended to something that does not exist.
      remember(null);
      setOpenRef(null);
      setTurns([]);
    } finally {
      setRestoring(false);
    }
  }, []);

  /**
   * Picks up steps the goal loop wrote after a run finished.
   *
   * Appends rather than reloading. A full reopen would replace every live turn with its
   * stored form — restarting the run polls and losing the plan objects the cards are drawn
   * from — to show one card that was not there before.
   */
  const absorb = useCallback(async (conversationRef: string) => {
    // Asked more than once, because the step does not exist when the run ends.
    //
    // A finished run is when the loop *starts* deciding, and deciding is a model call: on
    // a real goal the delete step appeared eleven seconds after the search returned. The
    // console asked at the instant the run finished, found nothing, and never looked
    // again — so the approval card never appeared and the goal looked like it had stopped
    // after one step.
    for (let attempt = 0; attempt < ABSORB_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise((resume) => setTimeout(resume, ABSORB_INTERVAL_MS));
      }

      let conversation;
      try {
        conversation = await conversationsApi.get(conversationRef);
      } catch {
        // The step is in the conversation either way and will be there on the next open.
        // A console that showed an error because it asked early would be reporting its own
        // timing as a problem with the goal.
        continue;
      }

      let found = false;

      setTurns((current) => {
        const shown = new Set(
          current.map((item) => item.saved?.id).filter((id): id is number => id != null),
        );

        const added = (conversation.turns ?? [])
          .filter((saved) => saved.awaitingApproval && !shown.has(saved.id))
          .map((saved) => ({
            id: nextId.current++,
            prompt: saved.prompt,
            executed: false,
            chosen: saved.pinnedTool ?? "",
            saved,
          }));

        found = added.length > 0;

        return found ? [...current, ...added] : current;
      });

      // Said out loud while it lasts. Deciding the next step is two model calls, and on a
      // real goal they took eleven seconds — during which the console showed nothing at
      // all and then produced an approval card out of a clear sky.
      //
      // Asked of the loop rather than worked out here. The first attempt read a column the
      // plan writes when it sets an action aside, which stopped being written once the
      // selection began choosing one action at a time: the indicator never appeared once.
      setContinuing(!found && conversation.continuing);

      // Stopped as soon as there is something, so the usual run — which proposes nothing —
      // costs one request rather than the whole window.
      if (found) {
        setContinuing(false);
        return;
      }
    }

    // The window is over either way: a step that has still not arrived is not one this
    // console can keep promising.
    setContinuing(false);
  }, []);

  // Reopens whatever was last open, which is what "carry on where I left off" means when
  // the page has been closed rather than navigated away from.
  useEffect(() => {
    const remembered = recall();
    if (remembered) void open(remembered);
  }, [open]);

  const start = () => {
    setOpenRef(null);
    setTurns([]);
    remember(null);
  };

  const onRunFinished = useCallback(() => {
    if (openRef) void absorb(openRef);
  }, [openRef, absorb]);

  const forget = async (conversationRef: string) => {
    try {
      await conversationsApi.remove(conversationRef);
      if (conversationRef === openRef) start();
      void conversationsStore.reload();
    } catch (error) {
      notify.failure(describe(error, t));
    }
  };

  const ask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const asked = prompt.trim();
    if (!asked || busy) return;

    const turn: Turn = {
      id: nextId.current++,
      prompt: asked,
      executed: execute,
      chosen: toolName,
    };

    // Added before the answer so the question is on screen while the model thinks about
    // it; a console that showed nothing until the reply arrived would look stuck.
    setTurns((current) => [...current, turn]);
    setPrompt("");
    setBusy(true);

    try {
      const answer = await toolsApi.prompt(
        asked,
        execute,
        toolName || undefined,
        openRef ?? undefined,
      );

      // The gateway decides which conversation this went into — a browser that named one
      // could append to a session it does not own.
      setOpenRef(answer.conversationRef);
      remember(answer.conversationRef);

      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id
            ? { ...item, result: answer.result, turnId: answer.turnId }
            : item,
        ),
      );
    } catch (error) {
      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id ? { ...item, failure: describe(error, t) } : item,
        ),
      );
    } finally {
      setBusy(false);
      // Even after a failure: the gateway records that turn too, and the sidebar would
      // otherwise be missing the conversation the question just started.
      void conversationsStore.reload();
    }
  };

  return (
    <>
      <PageHeader title={t("console.title")} description={t("console.subtitle")} />

      <CRow className="g-3">
        <CCol lg={4} xl={3}>
          <Conversations
            conversations={conversations.data}
            loading={conversations.loading}
            page={conversations.page}
            total={conversations.total}
            search={conversations.search}
            openRef={openRef}
            onOpen={open}
            onStart={start}
            onForget={forget}
          />
        </CCol>

        <CCol lg={8} xl={9}>
          <CAlert color="info" className="d-flex align-items-start gap-2">
            <CIcon icon={cilInfo} className="mt-1 flex-shrink-0" />
            <div className="small">{t("console.info")}</div>
          </CAlert>

          {restoring && (
            <div className="small text-body-secondary d-flex align-items-center gap-2 mb-3">
              <CSpinner size="sm" />
              {t("console.restoring")}
            </div>
          )}

          {!restoring && turns.length === 0 && (
            <CCard className="mb-3">
              <CCardBody className="text-body-secondary small">
                {t("console.empty")}
              </CCardBody>
            </CCard>
          )}

          <RunFinished.Provider value={onRunFinished}>
            {turns.map((turn) => (
              <TurnCard key={turn.id} turn={turn} />
            ))}
          </RunFinished.Provider>

          {continuing && (
            <CCard className="mb-3">
              <CCardBody className="small text-body-secondary d-flex align-items-center gap-2">
                <CSpinner size="sm" />
                {t("console.continuing")}
              </CCardBody>
            </CCard>
          )}

          <CCard className="mt-3">
            <CCardBody>
              <CForm onSubmit={ask}>
                <CFormTextarea
                  rows={3}
                  value={prompt}
                  placeholder={t("console.placeholder")}
                  // Named, because the sidebar's search box is a text field too and
                  // "the text field" stopped being unambiguous the moment it appeared.
                  aria-label={t("console.prompt")}
                  disabled={busy}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter sends; Shift+Enter is a newline. A prompt is usually one line,
                    // and reaching for the mouse for every question gets old quickly.
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />

                <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                  {/* Choosing a tool skips the model's choice, not the planning after it. A
                      definition is written for a particular job, and an operator who knows
                      which job they are doing should not have to hope a model agrees. */}
                  <CFormSelect
                    size="sm"
                    style={{ maxWidth: "20rem" }}
                    value={toolName}
                    onChange={(event) => setToolName(event.target.value)}
                    aria-label={t("console.toolLabel")}
                  >
                    <option value="">{t("console.toolAuto")}</option>
                    {tools
                      .filter((tool) => tool.enabled)
                      .map((tool) => (
                        <option key={tool.definitionId} value={tool.name}>
                          {tool.name}
                        </option>
                      ))}
                  </CFormSelect>
                </div>

                <div className="d-flex align-items-center justify-content-between mt-2">
                  <CFormCheck
                    id="console-execute"
                    checked={execute}
                    onChange={(event) => setExecute(event.target.checked)}
                    label={
                      <span className={execute ? "text-danger-emphasis fw-semibold" : undefined}>
                        {t("console.execute")}
                      </span>
                    }
                  />
                  <CButton color="primary" type="submit" disabled={busy || !prompt.trim()}>
                    {busy ? (
                      <CSpinner size="sm" className="me-2" />
                    ) : (
                      <CIcon icon={cilArrowRight} className="me-2" />
                    )}
                    {t("console.send")}
                  </CButton>
                </div>

                {execute && (
                  <div className="form-text text-danger-emphasis">
                    {t("console.executeWarning")}
                  </div>
                )}
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
}

/**
 * The sessions this person has had.
 *
 * Titled by the first question asked, because that is how anybody looks for one. A count
 * rather than a preview of the last answer: the answers are long, and the question is the
 * part somebody remembers.
 */
function Conversations({
  conversations,
  loading,
  page,
  total,
  search,
  openRef,
  onOpen,
  onStart,
  onForget,
}: {
  conversations: ConversationPayload[];
  loading: boolean;
  page: number;
  total: number;
  search: string;
  openRef: string | null;
  onOpen: (conversationRef: string) => void;
  onStart: () => void;
  onForget: (conversationRef: string) => void;
}) {
  const t = useT();

  // Typed here and sent to the store after a pause. Bound straight to the store, every
  // keystroke would be a request; bound only to local state, the box would clear itself
  // on the reload that follows every question.
  const [typed, setTyped] = useState(search);

  // The conversation the trash icon was clicked on, held until it is confirmed or let go.
  // The whole record rather than its reference, because the question being asked is "this
  // one?" and answering it needs the title.
  const [forgetting, setForgetting] = useState<ConversationPayload | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => conversationsStore.setSearch(typed), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const searching = search.trim().length > 0;

  return (
    <CCard>
      <CCardBody className="p-2">
        <CButton
          color="primary"
          variant="outline"
          size="sm"
          className="w-100 mb-2"
          onClick={onStart}
        >
          <CIcon icon={cilPlus} className="me-2" />
          {t("console.newConversation")}
        </CButton>

        <CInputGroup size="sm" className="mb-2">
          <CInputGroupText>
            <CIcon icon={cilMagnifyingGlass} size="sm" />
          </CInputGroupText>
          <CFormInput
            value={typed}
            placeholder={t("console.searchPlaceholder")}
            aria-label={t("console.search")}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setTyped(event.target.value)
            }
          />
          {typed && (
            <CButton
              color="secondary"
              variant="outline"
              title={t("console.searchClear")}
              aria-label={t("console.searchClear")}
              onClick={() => setTyped("")}
            >
              <CIcon icon={cilXCircle} size="sm" />
            </CButton>
          )}
        </CInputGroup>

        {loading && (
          <div className="small text-body-secondary p-2 d-flex align-items-center gap-2">
            <CSpinner size="sm" />
            {t("common.loading")}
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="small text-body-secondary p-2">
            {searching ? t("console.noMatches") : t("console.noConversations")}
          </div>
        )}

        <CListGroup flush>
          {conversations.map((conversation) => (
            <CListGroupItem
              key={conversation.conversationRef}
              as="button"
              type="button"
              active={conversation.conversationRef === openRef}
              className="d-flex align-items-start gap-2 text-start border-0 rounded-2"
              onClick={() => onOpen(conversation.conversationRef)}
            >
              <CIcon icon={cilChatBubble} className="mt-1 flex-shrink-0" size="sm" />

              <span className="flex-grow-1 small text-truncate">
                <span className="d-block text-truncate">
                  {conversation.title || t("console.untitled")}
                </span>
                <span className="d-block text-body-secondary">
                  {t("console.turnCount", { count: conversation.turnCount })}
                </span>
              </span>

              <CIcon
                icon={cilTrash}
                size="sm"
                role="button"
                title={t("console.forget")}
                aria-label={t("console.forget")}
                className="mt-1 flex-shrink-0 text-body-secondary"
                onClick={(event) => {
                  // Stops the row's own click: removing a conversation must not also open it.
                  event.stopPropagation();
                  setForgetting(conversation);
                }}
              />
            </CListGroupItem>
          ))}
        </CListGroup>

        {/* Only when there is more than one. A pager under three rows is furniture. */}
        {pages > 1 && (
          <CPagination
            size="sm"
            align="center"
            aria-label={t("console.pages")}
            className="mb-0 mt-2 flex-wrap"
          >
            <CPaginationItem
              role="button"
              disabled={page === 0 || loading}
              aria-label={t("console.previousPage")}
              onClick={() => conversationsStore.setPage(page - 1)}
            >
              ‹
            </CPaginationItem>

            {pageSlots(page, pages).map((slot, index) =>
              slot === GAP ? (
                // Not a button: there is no single page behind it to go to.
                <CPaginationItem key={`gap-${index}`} disabled aria-hidden="true">
                  …
                </CPaginationItem>
              ) : (
                <CPaginationItem
                  key={slot}
                  role="button"
                  active={slot === page}
                  disabled={loading}
                  aria-label={t("console.goToPage", { page: slot + 1 })}
                  aria-current={slot === page ? "page" : undefined}
                  onClick={() => conversationsStore.setPage(slot)}
                >
                  {slot + 1}
                </CPaginationItem>
              ),
            )}

            <CPaginationItem
              role="button"
              disabled={page >= pages - 1 || loading}
              aria-label={t("console.nextPage")}
              onClick={() => conversationsStore.setPage(page + 1)}
            >
              ›
            </CPaginationItem>
          </CPagination>
        )}
      </CCardBody>

      {/*
        Asked here rather than by the browser. `window.confirm` blocks the whole page on a
        dialog styled by the operating system, with no room to name the conversation being
        deleted — it asked "delete this conversation?" over a sidebar of twenty, and which
        one was "this" was whichever row the pointer had been over.
      */}
      <CModal
        visible={forgetting !== null}
        onClose={() => setForgetting(null)}
        alignment="center"
        aria-labelledby="forget-title"
      >
        <CModalHeader>
          <CModalTitle id="forget-title">{t("console.forget")}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {/* Named, so the answer is about a conversation and not about a row position. */}
          <p className="mb-2">
            {forgetting?.title || t("console.untitled")}
          </p>
          <p className="small text-body-secondary mb-0">
            {t("console.forgetConfirm")}
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setForgetting(null)}
          >
            {t("common.cancel")}
          </CButton>
          <CButton
            color="danger"
            onClick={() => {
              // Read before clearing: the handler runs after this state is gone.
              const going = forgetting;
              setForgetting(null);
              if (going) onForget(going.conversationRef);
            }}
          >
            {t("console.forget")}
          </CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  );
}

function TurnCard({ turn }: { turn: Turn }) {
  const t = useT();

  return (
    <CCard className="mb-3">
      <CCardBody>
        <div className="d-flex align-items-start gap-2 mb-3">
          <span className="avatar-initials bg-primary-subtle text-primary flex-shrink-0">
            <CIcon icon={cilUser} />
          </span>
          <div className="pt-1" style={{ whiteSpace: "pre-wrap" }}>
            {turn.prompt}
          </div>
        </div>

        {turn.failure && (
          <CAlert color="danger" className="small mb-0 d-flex gap-2">
            <CIcon icon={cilXCircle} className="mt-1 flex-shrink-0" />
            <div>{turn.failure}</div>
          </CAlert>
        )}

        {!turn.failure && !turn.result && !turn.saved && (
          <div className="small text-body-secondary d-flex align-items-center gap-2">
            <CSpinner size="sm" />
            {t("console.thinking")}
          </div>
        )}

        {turn.result && (
          <Answer
            result={turn.result}
            executed={turn.executed}
            chosen={turn.chosen}
            turnId={turn.turnId}
          />
        )}

        {!turn.result && turn.saved && !turn.failure && <Recalled turn={turn.saved} />}
      </CCardBody>
    </CCard>
  );
}

/**
 * A turn as it was written down, rather than as it was answered.
 *
 * What the gateway keeps is the decision, not the plan object: which tool, why, and the
 * statement it resolved to. The output is not kept here at all — {@code runRef} points at
 * the run that holds it, so this asks for it the same way the live console does and the
 * result is drawn by the same component. One copy of the data, in one place.
 */
function Recalled({ turn }: { turn: ConversationTurnPayload }) {
  const t = useT();
  const onFinished = useContext(RunFinished);

  if (!turn.toolName) {
    if (turn.answer) {
      return <Spoken answer={turn.answer} />;
    }

    return (
      <CAlert color="warning" className="small mb-0 d-flex gap-2">
        <CIcon icon={cilWarning} className="mt-1 flex-shrink-0" />
        <div>
          <div>{turn.problem ?? t("console.noMatch")}</div>
          {turn.reasoning && (
            <div className="text-body-secondary mt-1">{turn.reasoning}</div>
          )}
        </div>
      </CAlert>
    );
  }

  return (
    <>
      <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
        <CBadge color="primary" shape="rounded-pill" className="mono">
          {turn.toolName}
        </CBadge>
        {isPlanStatus(turn.status) && <StatusBadge status={turn.status} />}
        {turn.pinnedTool && (
          <span className="small text-body-secondary">{t("console.toolChosen")}</span>
        )}
        {!turn.executed && (
          <span className="small text-body-secondary">{t("console.planOnly")}</span>
        )}
      </div>

      {/* Which request this step serves.
          
          A conversation holds more than one goal at a time more often than it looks: leave
          a step unapproved, ask for something else, come back and approve it, and the first
          goal carries on from where it stopped — sometimes many minutes later, after the
          second request has come and gone. A card that says only "approve this command"
          then reads as the console going back to something already finished. */}
      {turn.goalPrompt && (
        <p className="small text-body-secondary mb-1">
          {t("console.forGoal", { goal: turn.goalPrompt })}
        </p>
      )}

      {turn.reasoning && <p className="small text-body-secondary">{turn.reasoning}</p>}

      {/* Above the statement, as in the live console: somebody who has already read the
          SQL and moved on will not come back for it. */}
      {turn.warnings && turn.warnings.length > 0 && <Narrowed warnings={turn.warnings} />}

      <Commands turn={turn} />

      {turn.awaitingApproval && (
        <Approve turnId={turn.id} count={turn.statements?.length ?? 1} />
      )}

      {turn.runRef && <RunOutcome runRef={turn.runRef} onFinished={onFinished} />}
    </>
  );
}

/**
 * A step the loop wrote, waiting for a person to say yes.
 *
 * The command above is what it resolved to when the loop planned it, and pressing this
 * plans it again — the same routing, the same guardrails — rather than sending that string
 * back to be run. A console that posted the command it was showing would be the one path
 * into the executor that skipped every check.
 */
/**
 * What this turn is about running: one command, or all of them.
 *
 * A plan whose commands all resolve from the one sentence is a single decision, and it is
 * shown whole so the decision can be made once. Numbered, because the order is the order
 * they run in and "write the file" before "run the file" is the whole of why it works.
 *
 * `statements` is null for every turn that showed one command, which is most of them and
 * all of the ones recorded before a card could hold several — those fall back to
 * `statement`, which still holds the first either way.
 */
function Commands({ turn }: { turn: ConversationTurnPayload }) {
  const all = turn.statements ?? (turn.statement ? [turn.statement] : []);

  if (all.length === 0) return null;

  return (
    <>
      {all.map((command, index) => (
        <div key={index} className="mb-2">
          {all.length > 1 && (
            <div className="small text-body-secondary mb-1">{index + 1}.</div>
          )}
          <Terminal kind="command" className="mb-0">{command}</Terminal>
        </div>
      ))}
    </>
  );
}

function Approve({ turnId, count }: { turnId: number; count: number }) {
  const t = useT();
  const onFinished = useContext(RunFinished);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  if (done) {
    return <RunOutcome runRef={done} onFinished={onFinished} />;
  }

  if (declined) {
    return (
      <div className="small text-body-secondary d-flex align-items-center gap-2">
        <CIcon icon={cilXCircle} className="flex-shrink-0" />
        {t("console.approve.declined")}
      </div>
    );
  }

  const run = async () => {
    setBusy(true);
    try {
      const answer = await toolsApi.approveStep(turnId);
      setDone(answer.result.dispatch?.run_id ?? null);
    } catch (error) {
      notify.failure(describe(error, t));
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await toolsApi.declineStep(turnId);
      setDeclined(true);
    } catch (error) {
      notify.failure(describe(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CAlert color="info" className="small mb-0 d-flex align-items-center gap-2 flex-wrap">
      <CIcon icon={cilInfo} className="flex-shrink-0" />
      <div className="flex-grow-1">
        {count > 1
          ? t("console.approve.waitingAll", { count })
          : t("console.approve.waiting")}
      </div>

      {/* Both, and the refusal first is not an accident: a row of buttons where only one
          of them does anything is not a question, and the command above is a delete as
          often as it is a read. */}
      <CButton
        color="secondary"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={decline}
      >
        {t("console.approve.decline")}
      </CButton>
      <CButton color="primary" size="sm" disabled={busy} onClick={run}>
        {busy ? <CSpinner size="sm" /> : t("console.approve.run")}
      </CButton>
    </CAlert>
  );
}

/** Whether a stored status is one the badge knows how to draw. */
/**
 * The model answering on its own, with nothing run.
 *
 * Marked as such and drawn differently from a result on purpose. A sentence about how many
 * accounts exist reads exactly like a count of them, and the difference between the two is
 * the difference between a fact and a guess — so the screen has to carry it, because the
 * words will not.
 */
function Spoken({ answer }: { answer: string }) {
  const t = useT();

  return (
    <div className="d-flex align-items-start gap-2">
      <span className="avatar-initials bg-body-secondary text-body-secondary flex-shrink-0">
        <CIcon icon={cilCommentSquare} />
      </span>
      <div>
        <div className="small text-body-secondary mb-1">{t("console.spoken")}</div>
        <div style={{ whiteSpace: "pre-wrap" }}>{answer}</div>
      </div>
    </div>
  );
}

function isPlanStatus(status: string | null): status is PlanPayload["status"] {
  return status === "planned" || status === "incomplete" || status === "rejected";
}

/**
 * Reading and writing which conversation is open.
 *
 * Wrapped because storage throws rather than returning null in a private window or when a
 * browser is set to block site data, and a console that could not start because of a
 * remembered reference would be a poor trade for the convenience.
 */
function recall(): string | null {
  try {
    return window.localStorage.getItem(LAST_OPENED);
  } catch {
    return null;
  }
}

function remember(conversationRef: string | null) {
  try {
    if (conversationRef) {
      window.localStorage.setItem(LAST_OPENED, conversationRef);
    } else {
      window.localStorage.removeItem(LAST_OPENED);
    }
  } catch {
    // A browser that will not store this is not a reason to fail the console.
  }
}

function Answer({
  result,
  executed,
  chosen,
  turnId,
}: {
  result: PromptResultPayload;
  executed: boolean;
  chosen: string;
  /** Absent until the gateway has answered; an approval needs it. */
  turnId?: number;
}) {
  const t = useT();

  // Nothing matched. Shown as an answer rather than an error: a request no tool serves is
  // a fact about the catalogue, not a fault of the person who asked.
  if (!result.tool_name) {
    return result.answer ? (
      <Spoken answer={result.answer} />
    ) : (
      <CAlert color="warning" className="small mb-0 d-flex gap-2">
        <CIcon icon={cilWarning} className="mt-1 flex-shrink-0" />
        <div>
          <div>{result.problem ?? t("console.noMatch")}</div>
          {result.reasoning && (
            <div className="text-body-secondary mt-1">{result.reasoning}</div>
          )}
        </div>
      </CAlert>
    );
  }

  return (
    <>
      <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
        <CBadge color="primary" shape="rounded-pill" className="mono">
          {result.tool_name}
        </CBadge>
        {result.status && <StatusBadge status={result.status} />}
        {/* Says who picked it. Otherwise a routing mistake and a deliberate choice look
            identical in the history, which is the wrong way round for reviewing later. */}
        {chosen && (
          <span className="small text-body-secondary">{t("console.toolChosen")}</span>
        )}
        {!executed && (
          <span className="small text-body-secondary">{t("console.planOnly")}</span>
        )}
      </div>

      {result.reasoning && (
        <p className="small text-body-secondary">{result.reasoning}</p>
      )}

      {Object.keys(result.arguments).length > 0 && (
        <pre className="mono small bg-body-tertiary border rounded-3 p-2 mb-3 text-body overflow-auto">
          {JSON.stringify(result.arguments, null, 2)}
        </pre>
      )}

      {result.plan && <PlanBody plan={result.plan} />}

      {result.dispatch && (
        <Dispatched
          dispatch={result.dispatch}
          turnId={turnId}
          // How many commands the card is asking about. The plan is right here, so it is
          // counted rather than sent: what is going to run is what is not set aside.
          count={
            result.plan?.actions.filter(
              (action) => !action.skipped && action.resolved,
            ).length ?? 1
          }
        />
      )}
    </>
  );
}

function PlanBody({ plan }: { plan: PlanPayload }) {
  const t = useT();

  return (
    <>
      {/* Above the statement, because it is about the statement and somebody who has
          already read the SQL and moved on will not come back for it. */}
      {plan.warnings?.length > 0 && <Narrowed warnings={plan.warnings} />}

      {plan.problems.length > 0 && (
        <CAlert
          color={plan.status === "rejected" ? "danger" : "warning"}
          className="small"
        >
          <ul className="mb-0 ps-3">
            {/* Indexed, not keyed by the text. Two actions of the same definition reach
                the same conclusion often — four REST actions all wanting an id produce
                four identical sentences — and React refuses a list with repeated keys. */}
            {plan.problems.map((problem, index) => (
              <li key={index}>{problem}</li>
            ))}
          </ul>
        </CAlert>
      )}

      {plan.actions.map((action) => (
        <div
          className={`border rounded-3 p-2 mb-2${action.skipped ? " opacity-50" : ""}`}
          key={action.action_id}
        >
          <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
            <span className="small fw-semibold">{action.name}</span>
            <CBadge
              color={action.skipped ? "secondary" : "secondary"}
              shape="rounded-pill"
            >
              {action.skipped ? t("console.notAskedFor") : action.kind}
            </CBadge>
          </div>

          {/* Shown, not dropped. A plan with one call in it has to say that the other
              three were considered and set aside — a different fact from their absence. */}
          {action.skipped ? (
            <div className="small text-body-secondary">
              {action.skip_reason || t("console.notAskedForHint")}
            </div>
          ) : (
            <>
              {action.targets.length > 0 && (
                <div className="small text-body-secondary mb-1">
                  {t("tools.run.targets", { targets: action.targets.join(", ") })}
                </div>
              )}

              {/* Withheld when rejected: the MCP server does not return unvetted text, so
                  there is nothing to show and nothing to copy by accident. */}
              {action.rejected_reasons.length > 0 ? (
                <div className="small text-danger-emphasis">
                  {action.rejected_reasons.join("; ")}
                </div>
              ) : (
                <Terminal kind="command" className="mb-0">{action.resolved}</Terminal>
              )}
            </>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * What the statement narrowed on that nobody asked for.
 *
 * The same component live and in history, because it is the same fact and the passage of
 * an hour does not change it — a result that quietly excluded rows reads as a complete
 * answer either way.
 */
function Narrowed({ warnings }: { warnings: PlanWarning[] }) {
  const t = useT();

  return (
    <CAlert color="warning" className="small d-flex gap-2">
      <CIcon icon={cilWarning} className="mt-1 flex-shrink-0" />
      <div className="d-grid gap-2">
        {warnings.map((warning) => (
          <div key={warning.code + warning.detail}>
            <div className="fw-semibold">{headline(warning.code, t)}</div>
            <div className="mono">{warning.detail}</div>
            {/* Each says only what was observed. "Not in the request" is not the same as
                "nobody asked for it": a question in Turkish about aktif accounts asks for
                exactly the status = 'active' it reports, and no string comparison will
                ever see that. So the screen asks rather than asserts. */}
            <div>{hint(warning.code, t)}</div>
          </div>
        ))}
      </div>
    </CAlert>
  );
}

/** The one-line heading for a warning code, falling back to the general one. */
function headline(code: string, t: ReturnType<typeof useT>): string {
  if (code === "repeats_earlier") return t("console.warn.repeat");
  if (code === "request_as_value") return t("console.warn.echo");
  if (code === "unrestricted_commands") return t("console.warn.unrestricted");
  if (code === "first_command_only") return t("console.warn.firstOnly");
  return t("console.warnings");
}

function hint(code: string, t: ReturnType<typeof useT>): string {
  if (code === "repeats_earlier") return t("console.warn.repeatHint");
  if (code === "request_as_value") return t("console.warn.echoHint");
  if (code === "unrestricted_commands") return t("console.warn.unrestrictedHint");
  if (code === "first_command_only") return t("console.warn.firstOnlyHint");
  return t("console.warningsHint");
}

function StatusBadge({ status }: { status: PlanPayload["status"] }) {
  const t = useT();
  const look = {
    planned: { color: "success", icon: cilCheckCircle },
    incomplete: { color: "warning", icon: cilWarning },
    rejected: { color: "danger", icon: cilXCircle },
  }[status];

  return (
    <CBadge color={look.color} shape="rounded-pill">
      <CIcon icon={look.icon} size="sm" className="me-1" />
      {t(`tools.run.status.${status}`)}
    </CBadge>
  );
}

function describe(error: unknown, t: ReturnType<typeof useT>): string {
  // The gateway's own message is preferred: it names the actual problem. The unreachable
  // case has no gateway message by definition, and that sentence is the panel's own.
  if (error instanceof ApiUnreachableError) return t(error.messageKey);
  if (error instanceof ApiRequestError) return error.message;
  return t("tools.run.unexpected");
}

/**
 * What happened to the plan after it was decided, and a way to stop it.
 *
 * The stop button only appears for a queued run, because that is the only state where
 * anything is out there to stop. It asks; whether the work actually ended arrives as a
 * result the gateway records, so the button reports that it asked rather than claiming the
 * run is over.
 */
function Dispatch({
  dispatch,
}: {
  dispatch: NonNullable<PromptResultPayload["dispatch"]>;
}) {
  const t = useT();
  const [cancelling, setCancelling] = useState(false);
  const [asked, setAsked] = useState(false);

  const runId = dispatch.run_id;
  const queued = dispatch.status === "queued" && runId;

  const stop = async () => {
    if (!runId) return;

    setCancelling(true);
    try {
      await runsApi.cancel(runId, "console");
      setAsked(true);
    } catch (error) {
      notify.failure(
        error instanceof ApiRequestError || error instanceof ApiUnreachableError
          ? error.message
          : t("tools.run.unexpected"),
      );
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="small text-body-secondary d-flex align-items-start gap-2 mt-2">
      <CIcon
        icon={dispatch.status === "queued" ? cilMediaPlay : cilWarning}
        className="mt-1 flex-shrink-0"
      />
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span>
          {dispatch.reason}
          {runId && <span className="mono ms-1">({runId.slice(0, 8)})</span>}
        </span>

        {queued && !asked && (
          <CButton
            size="sm"
            color="danger"
            variant="outline"
            disabled={cancelling}
            onClick={stop}
          >
            {cancelling ? <CSpinner size="sm" className="me-1" /> : null}
            {t("console.stop")}
          </CButton>
        )}

        {asked && <span className="text-warning-emphasis">{t("console.stopAsked")}</span>}
      </div>
    </div>
  );
}

/** The dispatch line and, once there is one, the result underneath it. */
function Dispatched({
  dispatch,
  turnId,
  count = 1,
}: {
  dispatch: NonNullable<PromptResultPayload["dispatch"]>;
  turnId?: number;
  count?: number;
}) {
  const onFinished = useContext(RunFinished);

  return (
    <>
      <Dispatch dispatch={dispatch} />

      {/* Nothing was dispatched: the action asks for a person to say yes to the command
          above first. Offered here as well as on a reopened conversation, so approving
          does not mean reloading the page to find the turn again. */}
      {dispatch.status === "awaiting_approval" && turnId != null && (
        <Approve turnId={turnId} count={count} />
      )}

      {dispatch.status === "queued" && dispatch.run_id && (
        <RunOutcome runRef={dispatch.run_id} onFinished={onFinished} />
      )}
    </>
  );
}
