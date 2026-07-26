// 계정 삭제 요청을 서비스 역할로 순차 처리하고 실패한 작업은 재검토 상태로 남깁니다.
import { createClient } from 'npm:@supabase/supabase-js@2.91.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const workerSecret = Deno.env.get('DELETION_WORKER_SECRET');

type DeletionJob = {
  id: string;
  user_id: string;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!supabaseUrl || !serviceRoleKey || !workerSecret) {
    return json(503, { error: 'worker_not_configured' });
  }
  if (request.headers.get('x-runningbom-worker-secret') !== workerSecret) {
    return json(401, { error: 'unauthorized' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from('deletion_jobs')
    .select('id,user_id')
    .eq('status', 'REQUESTED')
    .order('requested_at', { ascending: true })
    .limit(5);
  if (error) return json(500, { error: 'job_query_failed' });

  let completed = 0;
  let failed = 0;
  for (const job of (data ?? []) as DeletionJob[]) {
    const { data: claimed } = await admin
      .from('deletion_jobs')
      .update({ status: 'PROCESSING' })
      .eq('id', job.id)
      .eq('status', 'REQUESTED')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    try {
      const { data: profile } = await admin
        .from('profiles')
        .select('avatar_path')
        .eq('user_id', job.user_id)
        .maybeSingle();
      if (profile?.avatar_path) {
        const { error: storageError } = await admin.storage
          .from('avatars')
          .remove([profile.avatar_path]);
        if (storageError) throw storageError;
      }

      const { error: auditError } = await admin.from('audit_logs').insert({
        actor_id: null,
        action: 'ACCOUNT_DELETION_EXECUTED',
        target_type: 'USER',
        target_id: job.user_id,
        payload: { deletion_job_id: job.id },
      });
      if (auditError) throw auditError;

      const { error: deleteError } = await admin.auth.admin.deleteUser(job.user_id);
      if (deleteError) throw deleteError;
      completed += 1;
    } catch {
      failed += 1;
      await admin
        .from('deletion_jobs')
        .update({ status: 'FAILED' })
        .eq('id', job.id)
        .eq('status', 'PROCESSING');
    }
  }

  return json(200, { scanned: data?.length ?? 0, completed, failed });
});
