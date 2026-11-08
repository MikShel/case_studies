import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createSimulatedAvatar, type AvatarMood } from '../../avatar/AvatarAdapter';
import { runSteps, type CurrentStep } from '../../avatar/director';
import { createRecognizer } from '../../avatar/speechInput';
import type { HandoffRequest } from '../../data/types';
import { afterApproval, callTurn, endCall, leeLines, openCall, recapFor, type AdminFix, type CallState } from '../../engine/call';
import { followUp, newSession, respond, startFromContext, withRecipient, type Session, type Step } from '../../engine/session';
import { useStore } from '../../store/AppStore';
import { CallView } from './CallView';
import { HandoffCard } from './HandoffCard';

export const AVATAR_IMAGE = './avatar.svg';
/** lets the guided demo "say" a line as the employee */
export const AVA_SAY_EVENT = 'ava:say';
/** lets the guided demo act as the admin on a call: { type: 'line', text } | { type: 'approve' } | { type: 'end' } */
export const AVA_CALL_EVENT = 'ava:call';
const ADMIN_VOICE = { prefer: /daniel|fred|arthur|aaron|google uk english male|rishi|tom/i, pitch: 0.85 };

const GREETING = ["Hi Jordan, I'm Ava, an AI avatar for Expensio help. I can walk you through fixes and prepare requests for an admin, but I can't change anything myself."];
const STARTERS = ["I can't see my cost centre", "My receipt won't upload", 'My approval is stuck', "I can't open the team expense report", 'How do I book a flight?'];
const STEP_PAUSE_MS = 450;
const MOOD_LABEL: Record<AvatarMood, string> = { idle: '', speaking: 'Speaking…', listening: 'Listening…', thinking: 'Thinking…' };

type Message = { id: number; from: 'avatar' | 'user' | 'other'; text: string; who?: string };

export function AvaPanel({ active, onDragStart }: { active: boolean; onDragStart?: (e: ReactPointerEvent) => void }) {
  const { dispatch, get, epoch, world, config, support } = useStore();
  const avatar = useRef(createSimulatedAvatar()).current;
  const adminVoice = useRef(createSimulatedAvatar(undefined, ADMIN_VOICE)).current;
  const recognizer = useRef(createRecognizer()).current;

  const [messages, setMessages] = useState<Message[]>([]);
  const [card, setCard] = useState<HandoffRequest | null>(null);
  const [to, setTo] = useState('tom');
  const [step, setStep] = useState<CurrentStep | null>(null);
  const [mood, setMood] = useState<AvatarMood>('idle');
  const [caption, setCaption] = useState('');
  const [muted, setMuted] = useState(false);
  const [listening, setListening] = useState(false);
  const [awaiting, setAwaiting] = useState<Session['awaiting']>('describe');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState<CallState | null>(null);
  const [summary, setSummary] = useState<{ label: string; text: string }[] | null>(null);
  const [adminFix, setAdminFix] = useState<AdminFix | null>(null);
  const [adminSpeaking, setAdminSpeaking] = useState(false);
  const callRef = useRef<CallState | null>(null);

  const session = useRef<Session>(newSession);
  const ctrl = useRef<AbortController | null>(null);
  const cardVisible = useRef(false);
  const announced = useRef(new Set<string>());
  const nextId = useRef(1);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active && support.open;

  const addMessage = useCallback((m: Omit<Message, 'id'>) => {
    setMessages((ms) => [...ms, { ...m, id: nextId.current++ }]);
    if (m.from === 'avatar') setCaption(m.text);
  }, []);
  const showCard = useCallback((d: HandoffRequest | null) => {
    cardVisible.current = d !== null;
    setCard(d);
    if (d) setTo(d.to);
  }, []);

  useEffect(() => avatar.onMood(setMood), [avatar]);
  useEffect(() => adminVoice.onMood((m) => setAdminSpeaking(m === 'speaking')), [adminVoice]);
  useEffect(() => {
    avatar.setMuted(muted);
    adminVoice.setMuted(muted);
  }, [avatar, adminVoice, muted]);
  const setCallBoth = useCallback((c: CallState | null) => {
    callRef.current = c;
    setCall(c);
  }, []);
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: 'end' });
  }, [messages, card]);

  // fresh conversation on start and after a reset
  useEffect(() => {
    ctrl.current?.abort();
    avatar.stop();
    adminVoice.stop();
    session.current = newSession;
    setCallBoth(null);
    setSummary(null);
    setAdminFix(null);
    announced.current = new Set();
    showCard(null);
    setStep(null);
    setAwaiting('describe');
    nextId.current = 1;
    setMessages(GREETING.map((text) => ({ id: nextId.current++, from: 'avatar' as const, text })));
    setCaption(GREETING[0]);
  }, [epoch, avatar, adminVoice, showCard, setCallBoth]);

  // stop talking when the presenter switches view or closes the support window
  useEffect(() => {
    if (!active || !support.open) {
      ctrl.current?.abort();
      avatar.stop();
      adminVoice.stop();
    }
  }, [active, support.open, avatar, adminVoice]);

  // set up after `play` exists (the call's opening is played by the same director)
  const startCallRef = useRef<(d: HandoffRequest, withId: string) => void>(() => {});

  const play = useCallback(
    (steps: Step[], next: Session) => {
      session.current = next;
      setAwaiting(next.awaiting);
      const c = new AbortController();
      ctrl.current = c;
      setBusy(true);
      dispatch({ type: 'setAvaBusy', busy: true });
      void runSteps(steps, {
        avatar,
        setTab: (tab) => dispatch({ type: 'setMockTab', tab }),
        highlight: (ids) => dispatch({ type: 'highlight', ids }),
        clearHighlight: () => dispatch({ type: 'clearHighlight' }),
        pageAction: (actions, label) => dispatch({ type: 'avaActs', actions, label }),
        addMessage,
        setStep,
        showCard,
        send: (d) => dispatch({ type: 'send', draft: d }),
        addInfo: (id, text) => dispatch({ type: 'answerInfo', id, text }),
        startCall: (d, withId) => setTimeout(() => startCallRef.current(d, withId), 0),
        participantSay: async (who, text) => {
          const name = get().world.people.find((p) => p.id === who)?.name ?? who;
          setMessages((ms) => [...ms, { id: nextId.current++, from: 'other', who: name.split(' ')[0], text }]);
          setCaption(`${name.split(' ')[0]}: ${text}`);
          await adminVoice.speak(text);
        },
        showSummary: setSummary,
        showAdminCard: setAdminFix,
        pauseMs: STEP_PAUSE_MS,
        signal: c.signal,
      }).finally(() => {
        if (ctrl.current === c) {
          setBusy(false);
          dispatch({ type: 'setAvaBusy', busy: false });
        }
      });
    },
    [avatar, adminVoice, dispatch, addMessage, showCard, get],
  );

  startCallRef.current = (d, withId) => {
    const st = get();
    const r = openCall(st.config, st.world, d, withId);
    setCallBoth(r.call);
    setAdminFix(null);
    setStep(null);
    play(r.steps, session.current);
  };

  const interrupt = useCallback(() => {
    ctrl.current?.abort();
    avatar.stop();
    adminVoice.stop();
  }, [avatar, adminVoice]);

  /** The admin (played by the presenter) says something on the call. */
  const adminLine = useCallback(
    (text: string) => {
      const c = callRef.current;
      if (!c) return;
      interrupt();
      const st = get();
      const admin = st.world.people.find((p) => p.id === c.with)!;
      const r = callTurn(st.config, st.world, st.history, c, 'admin', text);
      setCallBoth(r.call);
      play([{ kind: 'participantSay', who: admin.id, text }, ...r.steps], session.current);
    },
    [get, interrupt, play, setCallBoth],
  );

  /** The admin's own approval: the only thing on the call that changes anything. */
  const approveOnCall = useCallback(() => {
    const c = callRef.current;
    if (!c?.fix) return;
    interrupt();
    setAdminFix(null);
    const recap = recapFor(get().world, { ...c, phase: 'approved' }, true);
    dispatch({ type: 'resolveOnCall', draft: c.draft, by: c.with, fix: c.fix, recap });
    const st = get();
    const r = afterApproval(st.config, st.world, c);
    setCallBoth(r.call);
    play(r.steps, session.current);
  }, [get, interrupt, dispatch, play, setCallBoth]);

  const declineOnCall = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    setAdminFix(null);
    setCallBoth({ ...c, phase: 'summary', fix: undefined });
  }, [setCallBoth]);

  const hangUp = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    interrupt();
    const st = get();
    const r = endCall(st.config, st.world, c);
    setCallBoth(null);
    setSummary(null);
    setAdminFix(null);
    play(r.steps, r.session);
  }, [get, interrupt, play, setCallBoth]);

  const submit = useCallback(
    (text: string, fromMic = false) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (callRef.current) {
        // on the call, Jordan's words go to the call, not to a new troubleshooting turn
        interrupt();
        addMessage({ from: 'user', text: trimmed });
        const st = get();
        const r = callTurn(st.config, st.world, st.history, callRef.current, 'employee', trimmed);
        setCallBoth(r.call);
        play(r.steps, session.current);
        return;
      }
      ctrl.current?.abort();
      avatar.stop();
      if (!fromMic) recognizer.stop();
      const visible = cardVisible.current;
      const base = withRecipient(session.current, to);
      showCard(null);
      addMessage({ from: 'user', text: trimmed });
      const st = get();
      const result = respond(st.config, st.world, base, trimmed, visible, st.mockTab);
      play(result.steps, result.session);
    },
    [avatar, recognizer, to, showCard, addMessage, get, play, interrupt, setCallBoth],
  );

  // "Get help" from the page: Ava starts from what she sees there, then asks for consent
  const lastAsk = useRef(0);
  useEffect(() => {
    if (support.ask.n === lastAsk.current) return;
    lastAsk.current = support.ask.n;
    const id = support.ask.issueId;
    if (!id || callRef.current) return;
    interrupt();
    showCard(null);
    setStep(null);
    const st = get();
    const r = startFromContext(st.config, st.world, id, st.mockTab);
    play(r.steps, r.session);
  }, [support.ask, get, interrupt, play, showCard]);

  // the guided demo can speak for the employee
  useEffect(() => {
    // ignored while the employee view is hidden: nobody would see or hear it
    const onSay = (e: Event) => {
      if (activeRef.current) submit((e as CustomEvent<string>).detail);
    };
    const onCall = (e: Event) => {
      if (!activeRef.current) return;
      const d = (e as CustomEvent<{ type: 'line' | 'approve' | 'end'; text?: string }>).detail;
      if (d.type === 'line' && d.text) adminLine(d.text);
      if (d.type === 'approve') approveOnCall();
      if (d.type === 'end') hangUp();
    };
    window.addEventListener(AVA_SAY_EVENT, onSay);
    window.addEventListener(AVA_CALL_EVENT, onCall);
    return () => {
      window.removeEventListener(AVA_SAY_EVENT, onSay);
      window.removeEventListener(AVA_CALL_EVENT, onCall);
    };
  }, [submit, adminLine, approveOnCall, hangUp]);

  // follow up when an admin has acted on one of Jordan's requests
  useEffect(() => {
    // wait until the call is over; it will be announced then
    if (!active || call) return;
    // requests resolved live on a call were already confirmed on the call
    const due = world.requests.find((r) => !r.onCall && r.status !== 'waiting' && !announced.current.has(`${r.id}:${r.status}`));
    if (!due) return;
    announced.current.add(`${due.id}:${due.status}`);
    const st = get();
    const f = followUp(st.config, st.world, due, session.current);
    interrupt();
    play(f.steps, f.session);
  }, [active, call, world.requests, get, interrupt, play]);

  const toggleMic = () => {
    if (listening) {
      recognizer.stop();
      return;
    }
    interrupt();
    setListening(true);
    avatar.setMood('listening');
    recognizer.start(
      (t) => submit(t, true),
      () => {
        setListening(false);
        setMood((m) => (m === 'listening' ? 'idle' : m));
      },
    );
  };

  const chips = call ? ['Thanks!'] : awaiting === 'describe' || awaiting === 'done' ? STARTERS : ['Yes', 'No'];
  const callAdmin = call ? world.people.find((p) => p.id === call.with) : undefined;
  const mine = world.requests;

  return (
    <aside className="ava" data-busy={busy || undefined}>
      <div className="ava-head" onPointerDown={onDragStart}>
        <span>
          <b>Ava</b> <span className="muted small">· Expensio help</span>
        </span>
        <span className="ai-label" title="This is an AI avatar">
          AI avatar
        </span>
        <button className="icon" title={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
          {muted ? '🔇' : '🔊'}
        </button>
        {support.mode === 'docked' ? (
          <button className="icon" title="Pop out over the portal" onClick={() => dispatch({ type: 'setSupportMode', mode: 'floating' })}>
            ⇱
          </button>
        ) : (
          <button className="icon" title="Dock to the side" onClick={() => dispatch({ type: 'setSupportMode', mode: 'docked' })}>
            ⇲
          </button>
        )}
        <button className="icon" title="Close support (keeps the conversation)" onClick={() => dispatch({ type: 'closeSupport' })}>
          ✕
        </button>
      </div>
      {!config.published && <div className="preview-banner">Preview: this session isn't published yet</div>}

      {call && callAdmin ? (
        <CallView
          adminName={callAdmin.name}
          avaMood={mood}
          adminSpeaking={adminSpeaking}
          caption={caption}
          summary={summary}
          fix={adminFix}
          adminLines={adminFix ? [] : leeLines(call)}
          busy={busy}
          avatarImage={AVATAR_IMAGE}
          onAdminLine={adminLine}
          onApprove={approveOnCall}
          onDecline={declineOnCall}
          onEnd={hangUp}
        />
      ) : (
        <div className={`video ${mood}`}>
          <img src={AVATAR_IMAGE} alt="Ava" />
          <span className="video-mood">{MOOD_LABEL[mood]}</span>
          {caption && <div className="caption">{caption}</div>}
        </div>
      )}

      {step && !call && (
        <div className="step-panel" data-hl="step-panel">
          <div className="step-panel-head">
            <b>{step.label}</b>
            <span className="source">📄 {step.source}</span>
          </div>
          <div>{step.text}</div>
        </div>
      )}

      {mine.length > 0 && (
        <div className="my-requests">
          {mine.map((r) => (
            <div key={r.id} className={`req req-${r.status}`}>
              <span>{r.change}</span>
              <span className="req-status">{r.status === 'waiting' ? '⏳ Waiting for admin' : r.status === 'approved' ? (r.onCall ? '✓ Fixed on a call' : '✓ Approved') : '❓ Info requested'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="transcript">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.from}`}>
            {m.who && <b className="msg-who">{m.who}: </b>}
            {m.text}
          </div>
        ))}
        {card && <HandoffCard draft={card} to={to} onTo={setTo} onAnswer={(yes) => submit(yes ? 'Yes' : 'No')} onCall={(name) => submit(`Call ${name} now`)} />}
        <div ref={transcriptEnd} />
      </div>

      <div className="chips-row">
        {chips.map((c) => (
          <button key={c} className="chip" onClick={() => submit(c)}>
            {c}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
          setDraft('');
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tell Ava what's wrong…" aria-label="Message Ava" />
        {recognizer.supported && (
          <button type="button" className={listening ? 'rec' : ''} title={listening ? 'Stop listening' : 'Talk'} onClick={toggleMic}>
            🎤
          </button>
        )}
      </form>
    </aside>
  );
}
