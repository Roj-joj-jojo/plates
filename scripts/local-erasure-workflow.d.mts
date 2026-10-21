export function localErasureEnabled(env: NodeJS.ProcessEnv, authId: string): boolean;
export function openLocalErasureStore(env?: NodeJS.ProcessEnv): Promise<unknown>;
export function createLocalErasureAdmin(env?: NodeJS.ProcessEnv): import("@supabase/supabase-js").SupabaseClient;
export function requestRecordedErasure(input: {
  authId: string;
  store: unknown;
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}): Promise<{ accepted: boolean }>;
export function requestAdminRecordedErasure(input: {
  actorAuthId: string;
  profileId: string;
  store: unknown;
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}): Promise<{ accepted: boolean }>;
