-- Topic and coarse region are selected by the author. Legacy rows remain untagged.
alter table public.posts
  add column if not exists topic text check (topic in ('러닝일상','대회후기','러닝화','질문','응원')),
  add column if not exists region text check (region in ('서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'));

create index if not exists posts_feed_cursor_idx on public.posts(created_at desc,id desc)
  where status='ACTIVE' and visibility='PUBLIC';
create index if not exists posts_feed_topic_cursor_idx on public.posts(topic,created_at desc,id desc)
  where status='ACTIVE' and visibility='PUBLIC' and topic is not null;
create index if not exists posts_feed_region_cursor_idx on public.posts(region,created_at desc,id desc)
  where status='ACTIVE' and visibility='PUBLIC' and region is not null;
create extension if not exists pg_trgm with schema extensions;
create index if not exists posts_feed_body_trgm_idx on public.posts using gin(body extensions.gin_trgm_ops)
  where status='ACTIVE' and visibility='PUBLIC';

-- Preserve the existing column order, grants and invoker/RLS boundary.
create or replace view public.public_posts with (security_invoker=true) as
select p.id,p.author_id,pr.nickname as author_nickname,p.body,p.kind,p.visibility,
 p.created_at,p.edited_at,
 coalesce((select jsonb_object_agg(grouped.kind,grouped.reaction_count)
   from (select r.kind,count(*)::integer as reaction_count from public.reactions r
         where r.post_id=p.id group by r.kind) grouped),'{}'::jsonb) as reaction_counts,
 (select count(*)::integer from public.comments c where c.post_id=p.id and c.status='ACTIVE') as comment_count,
 p.topic,p.region
from public.posts p join public.profiles pr on pr.user_id=p.author_id
where p.status='ACTIVE' and p.visibility='PUBLIC';
grant select on public.public_posts to anon,authenticated;
