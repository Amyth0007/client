import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { api } from "../../services/api-client.js";
import { useAuth } from "../auth/AuthContext.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { applyNavOrder, buildNavGroups, type NavGroup } from "../../components/layouts/navigation.js";

/** Flattens groups into the saved key list: each section id followed by its screen paths. */
function toOrder(groups: NavGroup[]): string[] {
  return groups.flatMap((group) => [group.id, ...group.items.map((item) => item.path)]);
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const iconButton = "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-500";

/** Lets an organization admin set the priority (order) of menu sections and screens for everyone. */
export function MenuOrderSettings() {
  const { user, refreshProfile } = useAuth();
  const savedOrder = user?.organization?.navOrder ?? [];
  // Default order, ignoring any saved preference, so "Reset" and new screens behave predictably.
  const defaultGroups = useMemo(
    () => buildNavGroups(user ? { ...user, organization: user.organization ? { ...user.organization, navOrder: [] } : user.organization } : null),
    [user],
  );
  const [groups, setGroups] = useState<NavGroup[]>(() => applyNavOrder(defaultGroups, savedOrder));
  const [isSaving, setIsSaving] = useState(false);

  const dirty = toOrder(groups).join("|") !== toOrder(applyNavOrder(defaultGroups, savedOrder)).join("|");

  const moveGroup = (index: number, delta: number) => setGroups((current) => move(current, index, delta));
  const moveItem = (groupIndex: number, itemIndex: number, delta: number) =>
    setGroups((current) => current.map((group, index) => (index === groupIndex ? { ...group, items: move(group.items, itemIndex, delta) } : group)));

  const save = async (order: string[]) => {
    setIsSaving(true);
    try {
      await api.updateOrganization({ settings: { navOrder: order } });
      await refreshProfile();
      toast.success(order.length ? "Menu order saved for your organization" : "Menu order reset to default");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the menu order");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card
      title="Menu order"
      subtitle="Move sections and screens up or down. Everyone in your organization sees this order, and the first screen becomes the home page after sign-in."
    >
      <div className="space-y-3">
        {groups.map((group, groupIndex) => {
          const GroupIcon = group.icon;
          return (
            <section key={group.id} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">{groupIndex + 1}</span>
                <GroupIcon className="h-4 w-4 shrink-0 text-indigo-600" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{group.label}</span>
                <button type="button" className={iconButton} disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)} aria-label={`Move ${group.label} up`} title="Move section up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" className={iconButton} disabled={groupIndex === groups.length - 1} onClick={() => moveGroup(groupIndex, 1)} aria-label={`Move ${group.label} down`} title="Move section down"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path} className="flex items-center gap-3 px-3 py-2 pl-12">
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{item.label}</span>
                      {groupIndex === 0 && itemIndex === 0 && <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:inline">Home page</span>}
                      <button type="button" className={iconButton} disabled={itemIndex === 0} onClick={() => moveItem(groupIndex, itemIndex, -1)} aria-label={`Move ${item.label} up`} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" className={iconButton} disabled={itemIndex === group.items.length - 1} onClick={() => moveItem(groupIndex, itemIndex, 1)} aria-label={`Move ${item.label} down`} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <Button type="button" size="sm" variant="ghost" disabled={isSaving || savedOrder.length === 0} onClick={() => { setGroups(defaultGroups); void save([]); }}>
            <RotateCcw className="h-4 w-4" />Reset to default
          </Button>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!dirty || isSaving} onClick={() => setGroups(applyNavOrder(defaultGroups, savedOrder))}>Discard</Button>
            <Button type="button" size="sm" disabled={!dirty} isLoading={isSaving} onClick={() => save(toOrder(groups))}>Save order</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
