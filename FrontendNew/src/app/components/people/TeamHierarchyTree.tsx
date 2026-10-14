import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Mail, Users as UsersIcon } from "lucide-react";
import { RoleBadge } from "../shared/StatusBadge";
import type { TeamHierarchyRow } from "../../../services/personnel.service";

interface TreeNode extends TeamHierarchyRow {
  children: TreeNode[];
}

function buildTree(rows: TeamHierarchyRow[]): TreeNode[] {
  const nodes = new Map<number, TreeNode>();
  rows.forEach((r) => nodes.set(r.id, { ...r, children: [] }));

  const roots: TreeNode[] = [];
  nodes.forEach((node) => {
    if (node.manager_id != null && nodes.has(node.manager_id)) {
      nodes.get(node.manager_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const byName = (a: TreeNode, b: TreeNode) => a.full_name.localeCompare(b.full_name);
  const sortRec = (list: TreeNode[]) => {
    list.sort(byName);
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const initials = node.full_name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2.5 pr-3 hover:bg-[#F9FBF9] rounded-lg"
        style={{ paddingLeft: `${12 + depth * 28}px` }}
      >
        <button
          onClick={() => hasChildren && setExpanded((v) => !v)}
          className="w-5 h-5 flex items-center justify-center shrink-0"
          style={{ visibility: hasChildren ? "visible" : "hidden", color: "#6B7280" }}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] shrink-0"
          style={{ background: "linear-gradient(135deg, #1B5E20, #43A047)", fontWeight: 600 }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] truncate" style={{ color: "#0A0A0A", fontWeight: 600 }}>{node.full_name}</span>
            <RoleBadge role={node.role_name ?? "Worker"} />
            {node.has_login ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: node.is_active ? "#E8F5E9" : "#F3F4F6", color: node.is_active ? "#1B5E20" : "#6B7280" }}
              >
                {node.is_active ? "Active login" : "Inactive login"}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#F3F4F6", color: "#9CA3AF" }}>
                No app login
              </span>
            )}
          </div>
          {node.email && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: "#6B7280" }}>
              <Mail className="w-3 h-3" /> {node.email}
            </div>
          )}
        </div>

        {hasChildren && (
          <div className="flex items-center gap-1 text-[11px] shrink-0" style={{ color: "#6B7280" }}>
            <UsersIcon className="w-3.5 h-3.5" />
            {countDescendants(node)} report{countDescendants(node) === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="border-l ml-6" style={{ borderColor: "#EEF2EE" }}>
          {node.children.map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamHierarchyTree({ rows }: { rows: TeamHierarchyRow[] }) {
  const tree = useMemo(() => buildTree(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "#9CA3AF" }} />
        <p className="text-[13px]" style={{ color: "#9CA3AF" }}>No team members found</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {tree.map((root) => (
        <TreeRow key={root.id} node={root} depth={0} />
      ))}
    </div>
  );
}
