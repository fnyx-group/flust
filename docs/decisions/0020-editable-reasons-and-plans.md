# 0020 Editable reasons and plans

## Context

After the onboarding, the user can edit their reasons, their risk moments and several if/then plans ([Features](../product/features.md#reasons-and-plans-editor)). The emergency screen shows every reason and every plan, and the lapse screen adjusts the first plan. A lapse that changed the first plan can be undone the same day, and the plan in place before it must come back unless the user changed that plan since ([Scenarios](../product/scenarios.md#ranks-and-lapses)).

Until now only a lapse could change plans, always through the first row, so an undo could find the plan it changed by taking the first plan and comparing its content. Once plans can be removed, that breaks: removing the first plan moves the next one up, and an undo would overwrite or delete a plan the lapse never touched.

## Decision

- Reasons and plans are edited in place, by row id. New ones are added at the end, so the first plan stays first. Lists are never rewritten as a whole, which would give rows new ids.
- Migration 6 adds `plan_id` to `lapse_detail`: the row the lapse wrote. Earlier plan changes point at the first readable plan at the time of the migration, which is the row each of them wrote, since nothing else could change plans before.
- `planToRestore` (`src/domain/lapse.ts`) takes that row as stored now. The previous plan is written back into it only while it still holds the plan the lapse set. A row removed or edited since is the user's newer choice and is left alone; no other row is ever touched. A plan the lapse added, when there was none, is removed only while another plan remains. When another plan already holds the previous one, the row the lapse wrote is removed instead of listing that plan twice.
- There are at most 10 reasons and 5 plans, and at least one plan, so the emergency screen stays readable and always has a plan to show. The rules live in `src/domain/profile.ts` and run inside each write's transaction, on the rows read in it. Only readable rows count. A reason or a plan identical to another one is refused. Editing stays possible above the limits.
- Unchecking a risk moment never rewrites a plan that uses it: the plan keeps its trigger, which stays among the editor's options, like on the lapse screen.
- Plans are listed in two columns, "If" and "Then", with the editor's labels, and read by screen readers as the full plan sentence.
- There is no reordering in this version.

## Consequences

- An undo never changes a plan the user edited, added or kept after the lapse, and never lists the same plan twice.
- A plan edited away and then back to exactly what the lapse set counts as unchanged, so an undo restores the previous plan. A revision counter would tell them apart; it is not worth it for a same-day undo.
- The lapse screen can still set the first plan to a plan already in the list. The editor then refuses to save that duplicate unchanged, but any edit works.
- Reordering, if added, needs no migration: the undo follows the row wherever it is.
