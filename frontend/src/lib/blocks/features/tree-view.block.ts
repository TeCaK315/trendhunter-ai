import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/TreeView.tsx': `'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, File, FolderOpen } from 'lucide-react';

interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  data?: any;
}

interface TreeViewProps {
  nodes: TreeNode[];
  onSelect?: (node: TreeNode) => void;
  defaultExpanded?: string[];
}

function TreeItem({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect?: (node: TreeNode) => void;
  selectedId: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) onToggle(node.id);
          onSelect?.(node);
        }}
        className="w-full flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-sm text-left hover:opacity-80 transition-all"
        style={{
          paddingLeft: depth * 20 + 8,
          background: isSelected ? '${t.primary10}' : 'transparent',
          color: isSelected ? '${t.primary}' : '${t.text}',
        }}
      >
        {hasChildren ? (
          isExpanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '${t.text50}' }} />
                     : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '${t.text50}' }} />
        ) : (
          <span className="w-4" />
        )}
        {hasChildren ? (
          isExpanded ? <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: '#eab308' }} />
                     : <Folder className="w-4 h-4 flex-shrink-0" style={{ color: '#eab308' }} />
        ) : (
          <File className="w-4 h-4 flex-shrink-0" style={{ color: '${t.text50}' }} />
        )}
        <span className="truncate">{node.label}</span>
        {hasChildren && (
          <span className="text-xs ml-auto" style={{ color: '${t.text50}' }}>
            {node.children!.length}
          </span>
        )}
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map(child => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TreeView({ nodes, onSelect, defaultExpanded = [] }: TreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(defaultExpanded));
  const [selectedId, setSelectedId] = useState('');

  function onToggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelect(node: TreeNode) {
    setSelectedId(node.id);
    onSelect?.(node);
  }

  function expandAll() {
    function collect(ns: TreeNode[]): string[] {
      return ns.flatMap(n => [n.id, ...(n.children ? collect(n.children) : [])]);
    }
    setExpanded(new Set(collect(nodes)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: '${t.primary40}' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: '${t.text50}' }}>
          {nodes.length} корневых элементов
        </span>
        <div className="flex gap-2">
          <button onClick={expandAll} className="text-xs hover:underline" style={{ color: '${t.primary}' }}>Развернуть</button>
          <button onClick={collapseAll} className="text-xs hover:underline" style={{ color: '${t.text50}' }}>Свернуть</button>
        </div>
      </div>
      {nodes.map(node => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={handleSelect}
          selectedId={selectedId}
        />
      ))}
    </div>
  );
}
`,
  };
}
