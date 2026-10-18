-- Text-only member features do not upload files. A private database worker can
-- complete deletion without putting a service-role key in a browser or app.
create extension if not exists pg_cron with schema pg_catalog;
alter table public.deletion_jobs add column attempts integer not null default 0 check(attempts between 0 and 5),
 add column next_attempt_at timestamptz not null default now();

create function runningbom_private.process_account_deletions() returns jsonb
language plpgsql security definer set search_path='' as $$
declare j record;done_count integer:=0;failed_count integer:=0;
begin
 for j in select id,user_id,attempts from public.deletion_jobs
  where status in ('REQUESTED','FAILED') and attempts<5 and next_attempt_at<=now()
  order by requested_at for update skip locked limit 10
 loop
  update public.deletion_jobs set status='PROCESSING',attempts=attempts+1 where id=j.id;
  begin
   -- Storage must be removed through its API, never by deleting object rows.
   -- If uploads are added later, route such requests to the existing SDK worker.
   if exists(select 1 from storage.objects where owner_id=j.user_id::text or owner=j.user_id) then
    update public.deletion_jobs set status='FAILED',attempts=5 where id=j.id;
    insert into runningbom_private.review_queue(target_type,target_id,reason)
     values('ACCOUNT_DELETE',j.id,'저장 파일을 Storage API로 제거한 뒤 계정 삭제 필요') on conflict do nothing;
    failed_count:=failed_count+1;
   else
    insert into public.audit_logs(actor_id,action,target_type,target_id,payload)
     values(null,'ACCOUNT_DELETION_EXECUTED','DELETION_JOB',j.id::text,'{}');
    delete from auth.users where id=j.user_id;
    done_count:=done_count+1;
   end if;
  exception when others then
   update public.deletion_jobs set status='FAILED',next_attempt_at=now()+interval '15 minutes'*power(2,j.attempts) where id=j.id;
   if j.attempts>=4 then
    insert into runningbom_private.review_queue(target_type,target_id,reason)
     values('ACCOUNT_DELETE',j.id,'계정 삭제 5회 실패: 관계 자료·저장 파일 확인 필요') on conflict do nothing;
   end if;
   failed_count:=failed_count+1;
  end;
 end loop;
 return jsonb_build_object('completed',done_count,'failed',failed_count);
end;$$;
revoke all on function runningbom_private.process_account_deletions() from public,anon,authenticated;

select cron.schedule('runningbom-account-cleanup','*/15 * * * *','select runningbom_private.process_account_deletions()');
select cron.schedule('runningbom-cron-history-retention','20 18 * * *',
 $$delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname like 'runningbom-%') and end_time<now()-interval '30 days'$$);
