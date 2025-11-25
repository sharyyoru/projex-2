"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type ElementType = "note" | "text" | "image" | "todo" | "color-swatch" | "column";

type BoardElement = {
  id: string;
  board_id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  locked: boolean;
  z_index: number;
  metadata: Record<string, any>;
};

const NOTE_COLORS = [
  { name: "Yellow", value: "#fef3c7" },
  { name: "Pink", value: "#fce7f3" },
  { name: "Blue", value: "#dbeafe" },
  { name: "Green", value: "#dcfce7" },
  { name: "Purple", value: "#f3e8ff" },
];

const ELEMENT_DEFAULTS: Record<ElementType, { width: number; height: number; color: string }> = {
  note: { width: 240, height: 160, color: "#fef3c7" },
  text: { width: 200, height: 40, color: "transparent" },
  image: { width: 300, height: 200, color: "transparent" },
  todo: { width: 260, height: 180, color: "#f1f5f9" },
  column: { width: 280, height: 400, color: "#f8fafc" },
  "color-swatch": { width: 80, height: 80, color: "#6366f1" },
};

export default function DanoteCanvas({ boardId }: { boardId: string }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [sidebarDragType, setSidebarDragType] = useState<ElementType | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabaseClient.from("danote_elements").select("*").eq("board_id", boardId).order("z_index")
      .then(({ data }) => { if (data) setElements(data as BoardElement[]); });
  }, [boardId]);

  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (sx - rect.left - offset.x) / scale, y: (sy - rect.top - offset.y) / scale };
  }, [offset, scale]);

  async function saveElement(el: Partial<BoardElement> & { id: string }) {
    await supabaseClient.from("danote_elements").update(el).eq("id", el.id);
  }

  async function addElement(type: ElementType, x: number, y: number) {
    const defaults = ELEMENT_DEFAULTS[type];
    const maxZ = elements.length > 0 ? Math.max(...elements.map((e) => e.z_index)) + 1 : 1;
    const content = type === "todo" ? JSON.stringify([{ id: crypto.randomUUID(), text: "", checked: false }]) : "";
    const { data, error } = await supabaseClient.from("danote_elements")
      .insert({ board_id: boardId, type, x, y, width: defaults.width, height: defaults.height, content, color: defaults.color, locked: false, z_index: maxZ, metadata: {} })
      .select().single();
    if (!error && data) {
      setElements((prev) => [...prev, data as BoardElement]);
      if (type === "note" || type === "text") setEditingId(data.id);
    }
  }

  async function deleteElement(id: string) {
    await supabaseClient.from("danote_elements").delete().eq("id", id);
    setElements((prev) => prev.filter((e) => e.id !== id));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function duplicateElement(el: BoardElement) {
    const maxZ = Math.max(...elements.map((e) => e.z_index)) + 1;
    const newEl = { ...el, x: el.x + 20, y: el.y + 20, z_index: maxZ };
    delete (newEl as any).id;
    const { data, error } = await supabaseClient.from("danote_elements").insert(newEl).select().single();
    if (!error && data) setElements((prev) => [...prev, data as BoardElement]);
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scale * delta, 0.1), 3);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        setScale(newScale);
        setOffset({ x: mx - (mx - offset.x) * (newScale / scale), y: my - (my - offset.y) * (newScale / scale) });
      }
    } else setOffset((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
  }, [scale, offset]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    setContextMenu(null);
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    } else if (e.button === 0 && !e.ctrlKey && !e.metaKey) setSelectedIds(new Set());
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    else if (draggingId) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      setElements((prev) => prev.map((el) => {
        if ((selectedIds.has(el.id) || el.id === draggingId) && !el.locked)
          return { ...el, x: el.x + pos.x - dragOffset.x, y: el.y + pos.y - dragOffset.y };
        return el;
      }));
      setDragOffset(pos);
    }
  }, [isPanning, panStart, draggingId, dragOffset, selectedIds, screenToCanvas]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    if (draggingId) {
      elements.forEach((el) => { if (selectedIds.has(el.id) || el.id === draggingId) saveElement({ id: el.id, x: el.x, y: el.y }); });
      setDraggingId(null);
    }
    setSidebarDragType(null);
  }, [draggingId, selectedIds, elements]);

  const handleElementMouseDown = useCallback((e: React.MouseEvent, el: BoardElement) => {
    e.stopPropagation();
    setContextMenu(null);
    if (el.locked) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    if (e.ctrlKey || e.metaKey) setSelectedIds((prev) => { const n = new Set(prev); n.has(el.id) ? n.delete(el.id) : n.add(el.id); return n; });
    else if (!selectedIds.has(el.id)) setSelectedIds(new Set([el.id]));
    setDraggingId(el.id);
    setDragOffset(pos);
    const maxZ = Math.max(...elements.map((e) => e.z_index)) + 1;
    setElements((prev) => prev.map((e) => (e.id === el.id ? { ...e, z_index: maxZ } : e)));
    saveElement({ id: el.id, z_index: maxZ });
  }, [screenToCanvas, selectedIds, elements]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (sidebarDragType) { const pos = screenToCanvas(e.clientX, e.clientY); addElement(sidebarDragType, pos.x, pos.y); setSidebarDragType(null); }
  }, [sidebarDragType, screenToCanvas]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const pos = screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);
      const maxZ = elements.length > 0 ? Math.max(...elements.map((e) => e.z_index)) + 1 : 1;
      const { data, error } = await supabaseClient.from("danote_elements")
        .insert({ board_id: boardId, type: "image", x: pos.x - 150, y: pos.y - 100, width: 300, height: 200, content: ev.target?.result as string, color: "transparent", locked: false, z_index: maxZ, metadata: {} })
        .select().single();
      if (!error && data) setElements((prev) => [...prev, data as BoardElement]);
      setUploading(false);
    };
    reader.onerror = () => setUploading(false);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (editingId) return;
      if (e.key === "Delete" || e.key === "Backspace") selectedIds.forEach((id) => deleteElement(id));
      if (e.key === "Escape") { setSelectedIds(new Set()); setContextMenu(null); }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") { e.preventDefault(); setSelectedIds(new Set(elements.map((e) => e.id))); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); selectedIds.forEach((id) => { const el = elements.find((e) => e.id === id); if (el) duplicateElement(el); }); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedIds, elements, editingId]);

  const sidebarItems = [
    { type: "note" as ElementType, icon: "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM7 7h10M7 11h10M7 15h4", label: "Note Card" },
    { type: "text" as ElementType, icon: "M4 7V4h16v3M9 20h6M12 4v16", label: "Text Block" },
    { type: "todo" as ElementType, icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", label: "To-Do List" },
    { type: "column" as ElementType, icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18", label: "Column" },
    { type: "color-swatch" as ElementType, icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01", label: "Color Swatch" },
  ];

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-56 flex-shrink-0 border-r border-slate-200 bg-white p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Elements</p>
        <div className="space-y-2">
          {sidebarItems.map((item) => (
            <div key={item.type} draggable onDragStart={() => setSidebarDragType(item.type)} className="flex cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition-all hover:border-cyan-300 hover:bg-cyan-50 active:cursor-grabbing">
              <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
              {item.label}
            </div>
          ))}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition-all hover:border-cyan-300 hover:bg-cyan-50 disabled:opacity-60 disabled:cursor-not-allowed">
            {uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500" />
            ) : (
              <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
            )}
            {uploading ? "Uploading..." : "Upload Image"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>
        <div className="mt-6">
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="rounded border-slate-300" />Show Grid</label>
          <p className="mt-3 text-xs text-slate-400">Zoom: {Math.round(scale * 100)}%</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setScale((s) => Math.min(s + 0.1, 3))} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">+</button>
            <button onClick={() => setScale((s) => Math.max(s - 0.1, 0.1))} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">-</button>
            <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">Reset</button>
          </div>
        </div>
        <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-400">
          <strong>Shortcuts:</strong><br />Shift+Drag: Pan<br />Ctrl+A: Select all<br />Ctrl+D: Duplicate<br />Delete: Remove
        </div>
      </div>
      <div ref={canvasRef} className="relative flex-1 overflow-hidden" style={{ background: showGrid ? "repeating-linear-gradient(0deg, transparent, transparent 19px, #e2e8f0 19px, #e2e8f0 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, #e2e8f0 19px, #e2e8f0 20px)" : "#f8fafc" }}
        onMouseDown={handleCanvasMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "0 0" }}>
          {elements.map((el) => <CanvasElement key={el.id} element={el} isSelected={selectedIds.has(el.id)} isEditing={editingId === el.id} onMouseDown={(e) => handleElementMouseDown(e, el)} onDoubleClick={() => !el.locked && setEditingId(el.id)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, elementId: el.id }); }} onContentChange={async (c) => { setElements((p) => p.map((e) => e.id === el.id ? { ...e, content: c } : e)); await saveElement({ id: el.id, content: c }); }} onEditEnd={() => setEditingId(null)} onColorChange={async (c) => { setElements((p) => p.map((e) => e.id === el.id ? { ...e, color: c } : e)); await saveElement({ id: el.id, color: c }); }} />)}
        </div>
        {contextMenu && <div className="fixed z-50 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={() => { const el = elements.find((e) => e.id === contextMenu.elementId); if (el) duplicateElement(el); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100">Duplicate</button>
          <button onClick={async () => { const el = elements.find((e) => e.id === contextMenu.elementId); if (el) { setElements((p) => p.map((e) => e.id === el.id ? { ...e, locked: !e.locked } : e)); await saveElement({ id: el.id, locked: !el.locked }); } setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100">Lock/Unlock</button>
          <button onClick={() => { deleteElement(contextMenu.elementId); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50">Delete</button>
        </div>}
      </div>
    </div>
  );
}

function CanvasElement({ element, isSelected, isEditing, onMouseDown, onDoubleClick, onContextMenu, onContentChange, onEditEnd, onColorChange }: { element: BoardElement; isSelected: boolean; isEditing: boolean; onMouseDown: (e: React.MouseEvent) => void; onDoubleClick: () => void; onContextMenu: (e: React.MouseEvent) => void; onContentChange: (c: string) => void; onEditEnd: () => void; onColorChange: (c: string) => void; }) {
  const base: React.CSSProperties = { position: "absolute", left: element.x, top: element.y, width: element.width, height: element.height, zIndex: element.z_index, cursor: element.locked ? "not-allowed" : "grab" };
  const sel = isSelected ? "ring-2 ring-cyan-500 ring-offset-2" : "";

  if (element.type === "note") {
    return <div style={{ ...base, backgroundColor: element.color }} className={`rounded-lg shadow-lg ${sel}`} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      {element.locked && <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-white"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div>}
      {isEditing ? <textarea autoFocus defaultValue={element.content} onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} onKeyDown={(e) => e.key === "Escape" && onEditEnd()} className="h-full w-full resize-none bg-transparent p-3 text-sm text-slate-700 focus:outline-none" placeholder="Type your note..." />
        : <div className="h-full w-full overflow-auto p-3 text-sm text-slate-700 whitespace-pre-wrap">{element.content || <span className="text-slate-400">Double-click to edit...</span>}</div>}
      {isSelected && <div className="absolute -bottom-8 left-0 flex gap-1">{NOTE_COLORS.map((c) => <button key={c.value} onClick={() => onColorChange(c.value)} className="h-5 w-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: c.value }} />)}</div>}
    </div>;
  }

  if (element.type === "text") {
    return <div style={base} className={sel} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      {isEditing ? <input autoFocus type="text" defaultValue={element.content} onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && onEditEnd()} className="h-full w-full bg-transparent text-lg font-semibold text-slate-800 focus:outline-none" placeholder="Add heading..." />
        : <div className="text-lg font-semibold text-slate-800">{element.content || <span className="text-slate-400">Double-click to add text...</span>}</div>}
    </div>;
  }

  if (element.type === "todo") {
    let todos: { id: string; text: string; checked: boolean }[] = [];
    try { todos = JSON.parse(element.content || "[]"); } catch {}
    return <div style={{ ...base, backgroundColor: element.color }} className={`rounded-lg shadow-lg ${sel}`} onMouseDown={onMouseDown} onContextMenu={onContextMenu}>
      <div className="p-3"><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">To-Do List</h4>
        <div className="space-y-1.5">{todos.map((todo, idx) => <label key={todo.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={todo.checked} onChange={(e) => { const n = [...todos]; n[idx] = { ...todo, checked: e.target.checked }; onContentChange(JSON.stringify(n)); }} className="rounded border-slate-300" />
          <input type="text" value={todo.text} onChange={(e) => { const n = [...todos]; n[idx] = { ...todo, text: e.target.value }; onContentChange(JSON.stringify(n)); }} placeholder="Task..." className={`flex-1 bg-transparent focus:outline-none ${todo.checked ? "text-slate-400 line-through" : "text-slate-700"}`} />
        </label>)}
          <button onClick={(e) => { e.stopPropagation(); onContentChange(JSON.stringify([...todos, { id: crypto.randomUUID(), text: "", checked: false }])); }} className="mt-1 text-xs text-cyan-600 hover:underline">+ Add item</button>
        </div></div></div>;
  }

  if (element.type === "image") {
    return <div style={base} className={`overflow-hidden rounded-lg shadow-lg ${sel}`} onMouseDown={onMouseDown} onContextMenu={onContextMenu}>
      <img src={element.content} alt="Uploaded" className="h-full w-full object-cover" draggable={false} /></div>;
  }

  if (element.type === "color-swatch") {
    return <div style={{ ...base, backgroundColor: element.color }} className={`rounded-xl shadow-lg ${sel}`} onMouseDown={onMouseDown} onContextMenu={onContextMenu}>
      <div className="absolute bottom-1 left-1 right-1 rounded bg-black/50 px-2 py-0.5 text-center text-[10px] font-mono text-white">{element.color.toUpperCase()}</div></div>;
  }

  if (element.type === "column") {
    return <div style={{ ...base, backgroundColor: element.color }} className={`rounded-2xl border-2 border-dashed border-slate-300 ${sel}`} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      <div className="border-b border-slate-200 px-4 py-3">{isEditing ? <input autoFocus type="text" defaultValue={element.content} onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} className="w-full bg-transparent font-semibold text-slate-700 focus:outline-none" />
        : <h3 className="font-semibold text-slate-700">{element.content || "Untitled Column"}</h3>}</div>
      <div className="p-2 text-center text-xs text-slate-400">Drop cards here</div></div>;
  }

  return null;
}
