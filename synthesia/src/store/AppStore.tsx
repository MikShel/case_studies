import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { createConfig, createHistory, createWorld } from '../data/seed';
import type { Config, HandoffRequest, IssueId, MockAction, MockTab, PastSession, Permission, Tag, World } from '../data/types';
import { canPublish, closeGap } from '../engine/creatorTest';
import type { AdminFix } from '../engine/call';
import { answerInfo, applyMock, approveRequest, askInfo, avaActs, resolveOnCall, sendRequest } from '../engine/world';

export type View = 'creator' | 'employee' | 'admin';
export type CreatorTab = 'knowledge' | 'boundary' | 'test';
export type AdminTab = 'inbox' | 'insights' | 'role' | 'governance' | 'metrics';

export type StoreAction =
  | { type: 'setView'; view: View }
  | { type: 'setCreatorTab'; tab: CreatorTab }
  | { type: 'setAdminTab'; tab: AdminTab }
  | { type: 'toggleNotes' }
  | { type: 'connect' }
  | { type: 'setTag'; issueId: IssueId; stepId: string; tag: Tag | undefined }
  | { type: 'closeGap' }
  | { type: 'publish' }
  | { type: 'mock'; action: MockAction }
  /** Ava acting on the employee's screen, after their yes */
  | { type: 'avaActs'; actions: MockAction[]; label: string }
  | { type: 'setPermission'; permission: Permission; allowed: boolean }
  | { type: 'setMockTab'; tab: MockTab }
  | { type: 'highlight'; ids: string[] }
  | { type: 'clearHighlight' }
  | { type: 'send'; draft: HandoffRequest }
  | { type: 'approve'; id: string; by: string }
  | { type: 'askInfo'; id: string; by: string; note: string }
  | { type: 'answerInfo'; id: string; text: string }
  | { type: 'resolveOnCall'; draft: HandoffRequest; by: string; fix: AdminFix; recap: string }
  | { type: 'setAvaBusy'; busy: boolean }
  /** the employee asks for help; issueId is what Ava sees on the page (null = just open) */
  | { type: 'openSupport'; issueId: IssueId | null }
  | { type: 'closeSupport' }
  | { type: 'setSupportMode'; mode: 'docked' | 'floating' }
  | { type: 'setInboxAs'; who: 'tom' | 'lee' }
  | { type: 'resetEmployee' }
  | { type: 'resetAll' };

export interface StoreState {
  config: Config;
  world: World;
  history: PastSession[];
  view: View;
  creatorTab: CreatorTab;
  adminTab: AdminTab;
  mockTab: MockTab;
  highlights: string[];
  notesOn: boolean;
  inboxAs: 'tom' | 'lee';
  /** bumps when the employee session restarts, so Ava starts a fresh conversation */
  epoch: number;
  /** bumps on "Reset demo", so the guided demo starts over too */
  generation: number;
  /** Ava is still playing a reply */
  avaBusy: boolean;
  /** the support window: hidden until the employee asks for help */
  support: { open: boolean; mode: 'docked' | 'floating'; ask: { issueId: IssueId | null; n: number } };
}

export function initialState(notesOn = false, epoch = 0, generation = 0): StoreState {
  return {
    config: createConfig(),
    world: createWorld(new Date()),
    history: createHistory(),
    view: 'creator',
    creatorTab: 'knowledge',
    adminTab: 'inbox',
    mockTab: 'new-expense',
    highlights: [],
    notesOn,
    inboxAs: 'tom',
    epoch,
    generation,
    avaBusy: false,
    support: { open: false, mode: 'docked', ask: { issueId: null, n: 0 } },
  };
}

/** A published session goes back to draft as soon as a change makes a test fail. */
function withConfig(st: StoreState, config: Config): StoreState {
  return { ...st, config: { ...config, published: config.published && canPublish(config) } };
}

export function reducer(st: StoreState, a: StoreAction): StoreState {
  switch (a.type) {
    case 'setView':
      return { ...st, view: a.view, highlights: [] };
    case 'setCreatorTab':
      return { ...st, creatorTab: a.tab };
    case 'setAdminTab':
      return { ...st, adminTab: a.tab };
    case 'toggleNotes':
      return { ...st, notesOn: !st.notesOn };
    case 'connect':
      return { ...st, config: { ...st.config, connected: true } };
    case 'setTag':
      return withConfig(st, {
        ...st.config,
        issues: st.config.issues.map((i) =>
          i.id !== a.issueId
            ? i
            : {
                ...i,
                steps: i.steps.map((s) => (s.id === a.stepId ? { ...s, tag: a.tag } : s)),
                workaround: i.workaround?.id === a.stepId ? { ...i.workaround, tag: a.tag } : i.workaround,
              },
        ),
      });
    case 'closeGap':
      return withConfig(st, closeGap(st.config));
    case 'publish':
      return canPublish(st.config) ? { ...st, config: { ...st.config, published: true } } : st;
    case 'mock':
      return { ...st, world: applyMock(st.world, a.action) };
    case 'avaActs':
      return { ...st, world: avaActs({ ...st.world, now: new Date().toISOString() }, a.actions, a.label) };
    case 'setPermission':
      return { ...st, config: { ...st.config, role: { ...st.config.role, [a.permission]: a.allowed } } };
    case 'setMockTab':
      return { ...st, mockTab: a.tab, highlights: [] };
    case 'highlight':
      return { ...st, highlights: a.ids };
    case 'clearHighlight':
      return { ...st, highlights: [] };
    case 'send':
      return { ...st, world: sendRequest({ ...st.world, now: new Date().toISOString() }, a.draft) };
    case 'approve':
      return { ...st, world: approveRequest(st.world, a.id, a.by) };
    case 'askInfo':
      return { ...st, world: askInfo(st.world, a.id, a.by, a.note) };
    case 'answerInfo':
      return { ...st, world: answerInfo(st.world, a.id, a.text) };
    case 'resolveOnCall':
      return { ...st, world: resolveOnCall({ ...st.world, now: new Date().toISOString() }, a.draft, a.by, a.fix, a.recap) };
    case 'openSupport':
      return { ...st, support: { ...st.support, open: true, ask: { issueId: a.issueId, n: st.support.ask.n + 1 } } };
    case 'closeSupport':
      return { ...st, support: { ...st.support, open: false } };
    case 'setSupportMode':
      return { ...st, support: { ...st.support, mode: a.mode } };
    case 'setAvaBusy':
      return st.avaBusy === a.busy ? st : { ...st, avaBusy: a.busy };
    case 'setInboxAs':
      return { ...st, inboxAs: a.who };
    case 'resetEmployee':
      return { ...st, world: createWorld(new Date()), mockTab: 'new-expense', highlights: [], epoch: st.epoch + 1, support: { ...st.support, open: false } };
    case 'resetAll':
      return initialState(st.notesOn, st.epoch + 1, st.generation + 1);
  }
}

interface Store extends StoreState {
  dispatch(a: StoreAction): void;
  /** latest state, safe to read from async code between steps */
  get(): StoreState;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [st, rawDispatch] = useReducer(reducer, undefined, () => initialState());
  const ref = useRef(st);
  ref.current = st;

  const dispatch = useCallback((a: StoreAction) => {
    ref.current = reducer(ref.current, a);
    rawDispatch(a);
  }, []);
  const get = useCallback(() => ref.current, []);

  const value = useMemo<Store>(() => ({ ...st, dispatch, get }), [st, dispatch, get]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside AppStoreProvider');
  return s;
}

/** data attribute + class for an element Ava can point at */
export function useHl() {
  const { highlights } = useStore();
  return (id: string, className?: string) => ({
    'data-hl': id,
    className: [className, highlights.includes(id) && 'hl'].filter(Boolean).join(' ') || undefined,
  });
}
