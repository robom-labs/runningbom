-- Preserve narrow column grants and all existing ownership/moderation policies.
grant insert(topic,region) on public.posts to authenticated;
