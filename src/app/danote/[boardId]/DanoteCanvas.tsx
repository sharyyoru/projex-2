"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import DanoteComments from "./DanoteComments";
import DanoteNotifications, { useNotificationCount } from "./DanoteNotifications";

type ElementType = "note" | "text-header" | "text-paragraph" | "text-sentence" | "image" | "todo" | "color-swatch" | "column" | "rectangle" | "circle" | "line" | "arrow" | "container" | "audio";

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
  parent_id: string | null; // For column parent-child relationships
  metadata: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    childIndex?: number; // Position in parent's children list
    [key: string]: any;
  };
};

const NOTE_COLORS = [
  { name: "Yellow", value: "#fef3c7" },
  { name: "Pink", value: "#fce7f3" },
  { name: "Blue", value: "#dbeafe" },
  { name: "Green", value: "#dcfce7" },
  { name: "Purple", value: "#f3e8ff" },
];

const ELEMENT_DEFAULTS: Record<ElementType, { width: number; height: number; color: string; metadata?: Record<string, any> }> = {
  note: { width: 240, height: 160, color: "#fef3c7" },
  "text-header": { width: 300, height: 50, color: "transparent" },
  "text-paragraph": { width: 300, height: 100, color: "transparent" },
  "text-sentence": { width: 200, height: 30, color: "transparent" },
  image: { width: 300, height: 200, color: "transparent" },
  todo: { width: 260, height: 180, color: "#f1f5f9" },
  column: { width: 280, height: 400, color: "#f8fafc" },
  "color-swatch": { width: 80, height: 80, color: "#6366f1" },
  rectangle: { width: 150, height: 100, color: "#1e293b", metadata: { fillColor: "#1e293b", strokeColor: "transparent", strokeWidth: 2 } },
  circle: { width: 100, height: 100, color: "#1e293b", metadata: { fillColor: "#1e293b", strokeColor: "transparent", strokeWidth: 2 } },
  line: { width: 200, height: 4, color: "#1e293b", metadata: { strokeColor: "#1e293b", strokeWidth: 3 } },
  arrow: { width: 200, height: 4, color: "#1e293b", metadata: { strokeColor: "#1e293b", strokeWidth: 3 } },
  container: { width: 320, height: 450, color: "#ffffff" },
  audio: { width: 280, height: 100, color: "#1e293b" },
};

const SHAPE_COLORS = [
  { name: "None", value: "transparent" },
  { name: "Black", value: "#1e293b" },
  { name: "White", value: "#ffffff" },
  { name: "Gray", value: "#64748b" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#f59e0b" },
  { name: "Green", value: "#10b981" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
];

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
  const [drawingMode, setDrawingMode] = useState<ElementType | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  
  // Resize state
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, elX: 0, elY: 0 });
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);
  
  // Rotation state
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateStart, setRotateStart] = useState({ angle: 0, centerX: 0, centerY: 0 });
  
  // Column drop zone state
  const [hoveredColumnId, setHoveredColumnId] = useState<string | null>(null);
  
  // Comments and notifications state
  const [showComments, setShowComments] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationCount = useNotificationCount();
  const [dropInsertIndex, setDropInsertIndex] = useState<number>(0);

  // Get children of a column sorted by childIndex
  const getColumnChildren = useCallback((columnId: string) => {
    return elements
      .filter(el => el.parent_id === columnId)
      .sort((a, b) => (a.metadata?.childIndex ?? 0) - (b.metadata?.childIndex ?? 0));
  }, [elements]);

  // Check if point is inside element bounds
  const isPointInElement = useCallback((x: number, y: number, el: BoardElement) => {
    return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
  }, []);

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
      .insert({ board_id: boardId, type, x, y, width: defaults.width, height: defaults.height, content, color: defaults.color, locked: false, z_index: maxZ, parent_id: null, metadata: {} })
      .select().single();
    if (!error && data) {
      setElements((prev) => [...prev, data as BoardElement]);
      if (type === "note" || type.startsWith("text-")) setEditingId(data.id);
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

  // Z-index arrangement functions
  async function bringForward(id: string) {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const sorted = [...elements].sort((a, b) => a.z_index - b.z_index);
    const idx = sorted.findIndex(e => e.id === id);
    if (idx < sorted.length - 1) {
      const nextEl = sorted[idx + 1];
      const newZ = nextEl.z_index + 1;
      setElements(prev => prev.map(e => e.id === id ? { ...e, z_index: newZ } : e));
      await saveElement({ id, z_index: newZ });
    }
  }

  async function sendBackward(id: string) {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const sorted = [...elements].sort((a, b) => a.z_index - b.z_index);
    const idx = sorted.findIndex(e => e.id === id);
    if (idx > 0) {
      const prevEl = sorted[idx - 1];
      const newZ = Math.max(0, prevEl.z_index - 1);
      setElements(prev => prev.map(e => e.id === id ? { ...e, z_index: newZ } : e));
      await saveElement({ id, z_index: newZ });
    }
  }

  async function bringToFront(id: string) {
    const maxZ = Math.max(...elements.map(e => e.z_index)) + 1;
    setElements(prev => prev.map(e => e.id === id ? { ...e, z_index: maxZ } : e));
    await saveElement({ id, z_index: maxZ });
  }

  async function sendToBack(id: string) {
    const minZ = Math.min(...elements.map(e => e.z_index));
    const newZ = Math.max(0, minZ - 1);
    setElements(prev => prev.map(e => e.id === id ? { ...e, z_index: newZ } : e));
    await saveElement({ id, z_index: newZ });
  }

  // Clipboard paste handler
  async function handlePaste(e: ClipboardEvent) {
    if (editingId) return; // Don't interfere with text editing
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        
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
        reader.readAsDataURL(blob);
        break;
      }
    }
  }

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [editingId, elements, screenToCanvas]);

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
    // Allow drawing mode to work even if clicking on inner elements
    if (drawingMode && e.button === 0 && !e.shiftKey) {
      e.preventDefault();
      const pos = screenToCanvas(e.clientX, e.clientY);
      setIsDrawing(true);
      setDrawStart(pos);
      setContextMenu(null);
      return;
    }
    
    if (e.target !== canvasRef.current) return;
    setContextMenu(null);
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    } else if (e.button === 0 && !e.ctrlKey && !e.metaKey) setSelectedIds(new Set());
  }, [offset, drawingMode, screenToCanvas]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    else if (rotatingId) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const angle = Math.atan2(pos.y - rotateStart.centerY, pos.x - rotateStart.centerX) * (180 / Math.PI) + 90;
      setElements((prev) => prev.map((el) => {
        if (el.id !== rotatingId) return el;
        return { ...el, metadata: { ...el.metadata, rotation: angle } };
      }));
    } else if (resizingId && resizeHandle) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const dx = pos.x - resizeStart.x;
      const dy = pos.y - resizeStart.y;
      
      setElements((prev) => prev.map((el) => {
        if (el.id !== resizingId) return el;
        let newX = resizeStart.elX, newY = resizeStart.elY;
        let newW = resizeStart.width, newH = resizeStart.height;
        
        if (resizeHandle.includes('e')) newW = Math.max(20, resizeStart.width + dx);
        if (resizeHandle.includes('w')) { newW = Math.max(20, resizeStart.width - dx); newX = resizeStart.elX + dx; }
        if (resizeHandle.includes('s')) newH = Math.max(20, resizeStart.height + dy);
        if (resizeHandle.includes('n')) { newH = Math.max(20, resizeStart.height - dy); newY = resizeStart.elY + dy; }
        
        return { ...el, x: newX, y: newY, width: newW, height: newH };
      }));
    } else if (draggingId) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const dx = pos.x - dragOffset.x;
      const dy = pos.y - dragOffset.y;
      
      // Get all elements being dragged (including children if dragging a column)
      const draggedElement = elements.find(el => el.id === draggingId);
      const childIds = draggedElement?.type === 'column' 
        ? elements.filter(el => el.parent_id === draggingId).map(el => el.id)
        : [];
      
      setElements((prev) => prev.map((el) => {
        const isDragged = (selectedIds.has(el.id) || el.id === draggingId) && !el.locked;
        const isChild = childIds.includes(el.id);
        
        if (isDragged || isChild) {
          // For lines and arrows, also update the metadata coordinates
          if (el.type === 'line' || el.type === 'arrow') {
            const meta = el.metadata || {};
            return { 
              ...el, 
              x: el.x + dx, 
              y: el.y + dy,
              metadata: {
                ...meta,
                startX: (meta.startX ?? el.x) + dx,
                startY: (meta.startY ?? el.y) + dy,
                endX: (meta.endX ?? el.x + el.width) + dx,
                endY: (meta.endY ?? el.y) + dy
              }
            };
          }
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
        return el;
      }));
      setDragOffset(pos);
      
      // Detect if dragging over a column for drop zone highlighting
      const draggedEl = elements.find(el => el.id === draggingId);
      if (draggedEl && draggedEl.type !== 'column') {
        const columns = elements.filter(el => el.type === 'column' && el.id !== draggingId);
        const dragCenterX = draggedEl.x + draggedEl.width / 2;
        const dragCenterY = draggedEl.y + draggedEl.height / 2;
        
        let foundColumn: BoardElement | null = null;
        for (const col of columns) {
          if (isPointInElement(dragCenterX, dragCenterY, col)) {
            foundColumn = col;
            break;
          }
        }
        
        if (foundColumn) {
          setHoveredColumnId(foundColumn.id);
          // Calculate insert index based on Y position
          const children = getColumnChildren(foundColumn.id);
          const headerHeight = 48; // Approximate header height
          const padding = 8;
          let insertIdx = children.length;
          let cumulativeY = foundColumn.y + headerHeight + padding;
          
          for (let i = 0; i < children.length; i++) {
            if (dragCenterY < cumulativeY + children[i].height / 2) {
              insertIdx = i;
              break;
            }
            cumulativeY += children[i].height + padding;
          }
          setDropInsertIndex(insertIdx);
        } else {
          setHoveredColumnId(null);
        }
      }
    }
  }, [isPanning, panStart, draggingId, dragOffset, selectedIds, screenToCanvas, resizingId, resizeHandle, resizeStart, rotatingId, rotateStart, elements, isPointInElement, getColumnChildren]);

  const handleCanvasMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (isDrawing && drawingMode) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const x = Math.min(drawStart.x, pos.x);
      const y = Math.min(drawStart.y, pos.y);
      const width = Math.max(Math.abs(pos.x - drawStart.x), 20);
      const height = Math.max(Math.abs(pos.y - drawStart.y), 20);
      
      const defaults = ELEMENT_DEFAULTS[drawingMode];
      const maxZ = elements.length > 0 ? Math.max(...elements.map((e) => e.z_index)) + 1 : 1;
      
      // For lines and arrows, store start/end points in metadata
      const metadata = (drawingMode === 'line' || drawingMode === 'arrow') 
        ? { startX: drawStart.x, startY: drawStart.y, endX: pos.x, endY: pos.y }
        : {};
      
      // Merge default metadata with line/arrow specific metadata
      const finalMetadata = { ...(defaults.metadata || {}), ...metadata };
      
      const { data, error } = await supabaseClient.from("danote_elements")
        .insert({ 
          board_id: boardId, 
          type: drawingMode, 
          x: drawingMode === 'line' || drawingMode === 'arrow' ? Math.min(drawStart.x, pos.x) : x, 
          y: drawingMode === 'line' || drawingMode === 'arrow' ? Math.min(drawStart.y, pos.y) : y, 
          width: drawingMode === 'line' || drawingMode === 'arrow' ? Math.abs(pos.x - drawStart.x) : width, 
          height: drawingMode === 'line' || drawingMode === 'arrow' ? Math.abs(pos.y - drawStart.y) : height, 
          content: '', 
          color: defaults.color, 
          locked: false, 
          z_index: maxZ, 
          metadata: finalMetadata 
        })
        .select().single();
      
      if (!error && data) setElements((prev) => [...prev, data as BoardElement]);
      setIsDrawing(false);
      setDrawingMode(null);
    }
  }, [isDrawing, drawingMode, drawStart, screenToCanvas, elements, boardId]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    setIsPanning(false);
    if (rotatingId) {
      const el = elements.find((e) => e.id === rotatingId);
      if (el) saveElement({ id: el.id, metadata: el.metadata });
      setRotatingId(null);
    }
    if (resizingId) {
      const el = elements.find((e) => e.id === resizingId);
      if (el) saveElement({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height });
      setResizingId(null);
      setResizeHandle(null);
    }
    if (draggingId) {
      const draggedEl = elements.find(el => el.id === draggingId);
      
      // Check if dropped on a column - reparent the element
      if (hoveredColumnId && draggedEl && draggedEl.type !== 'column') {
        const parentCol = elements.find(el => el.id === hoveredColumnId);
        if (parentCol) {
          // Update childIndex for all children and insert at dropInsertIndex
          const children = getColumnChildren(hoveredColumnId);
          const updatedChildren = children.map((child, idx) => {
            const newIndex = idx >= dropInsertIndex ? idx + 1 : idx;
            return { ...child, metadata: { ...child.metadata, childIndex: newIndex } };
          });
          
          // Calculate position inside column
          const headerHeight = 48;
          const padding = 8;
          let newY = parentCol.y + headerHeight + padding;
          for (let i = 0; i < dropInsertIndex; i++) {
            if (children[i]) newY += children[i].height + padding;
          }
          
          // Update the dragged element with parent_id and position
          const updatedEl = {
            ...draggedEl,
            parent_id: hoveredColumnId,
            x: parentCol.x + padding,
            y: newY,
            width: parentCol.width - padding * 2,
            metadata: { ...draggedEl.metadata, childIndex: dropInsertIndex }
          };
          
          setElements(prev => prev.map(el => {
            if (el.id === draggingId) return updatedEl;
            const updatedChild = updatedChildren.find(c => c.id === el.id);
            return updatedChild || el;
          }));
          
          // Save all changes
          saveElement({ id: updatedEl.id, parent_id: updatedEl.parent_id, x: updatedEl.x, y: updatedEl.y, width: updatedEl.width, metadata: updatedEl.metadata });
          updatedChildren.forEach(child => saveElement({ id: child.id, metadata: child.metadata }));
        }
      } else {
        // Normal drag - just save position
        const draggedEl = elements.find(el => el.id === draggingId);
        const childIds = draggedEl?.type === 'column' 
          ? elements.filter(el => el.parent_id === draggingId).map(el => el.id)
          : [];
        
        elements.forEach((el) => { 
          if (selectedIds.has(el.id) || el.id === draggingId || childIds.includes(el.id)) {
            // For lines/arrows, also save the updated metadata coordinates
            if (el.type === 'line' || el.type === 'arrow') {
              saveElement({ id: el.id, x: el.x, y: el.y, metadata: el.metadata });
            } else {
              saveElement({ id: el.id, x: el.x, y: el.y });
            }
          }
        });
      }
      
      setDraggingId(null);
      setHoveredColumnId(null);
    }
    setSidebarDragType(null);
    if (isDrawing) handleCanvasMouseUp(e);
  }, [draggingId, selectedIds, elements, isDrawing, handleCanvasMouseUp, resizingId, rotatingId, hoveredColumnId, dropInsertIndex, getColumnChildren]);

  const handleRotateStart = useCallback((e: React.MouseEvent, el: BoardElement) => {
    e.stopPropagation();
    e.preventDefault();
    const centerX = el.x + el.width / 2;
    const centerY = el.y + el.height / 2;
    setRotatingId(el.id);
    setRotateStart({ angle: el.metadata?.rotation ?? 0, centerX, centerY });
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent, el: BoardElement, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = screenToCanvas(e.clientX, e.clientY);
    setResizingId(el.id);
    setResizeHandle(handle);
    setResizeStart({ x: pos.x, y: pos.y, width: el.width, height: el.height, elX: el.x, elY: el.y });
  }, [screenToCanvas]);

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

  async function handleReplaceImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingImageId) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setElements((p) => p.map((el) => el.id === replacingImageId ? { ...el, content: ev.target?.result as string } : el));
      await saveElement({ id: replacingImageId, content: ev.target?.result as string });
      setUploading(false);
      setReplacingImageId(null);
    };
    reader.onerror = () => { setUploading(false); setReplacingImageId(null); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function clearImage(id: string) {
    setElements((p) => p.map((el) => el.id === id ? { ...el, content: "" } : el));
    saveElement({ id, content: "" });
  }

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
    { type: "container" as ElementType, icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z", label: "Container" },
    { type: "audio" as ElementType, icon: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z", label: "Audio" },
    { type: "todo" as ElementType, icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", label: "To-Do List" },
    { type: "column" as ElementType, icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18", label: "Column" },
    { type: "color-swatch" as ElementType, icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01", label: "Color Swatch" },
  ];

  const textItems = [
    { type: "text-header" as ElementType, icon: "M4 7V4h16v3M9 20h6M12 4v16", label: "Header" },
    { type: "text-paragraph" as ElementType, icon: "M4 6h16M4 10h16M4 14h10", label: "Paragraph" },
    { type: "text-sentence" as ElementType, icon: "M4 12h12", label: "Sentence" },
  ];

  const shapeItems = [
    { type: "rectangle" as ElementType, icon: "M3 3h18v18H3z", label: "Rectangle" },
    { type: "circle" as ElementType, icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z", label: "Circle" },
    { type: "line" as ElementType, icon: "M5 19L19 5", label: "Line" },
    { type: "arrow" as ElementType, icon: "M5 19L19 5M19 5v10M19 5H9", label: "Arrow" },
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
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Text</p>
          <div className="grid grid-cols-3 gap-1">
            {textItems.map((item) => (
              <div key={item.type} draggable onDragStart={() => setSidebarDragType(item.type)} className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600 transition-all hover:border-cyan-300 hover:bg-cyan-50 active:cursor-grabbing">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                {item.label}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Shapes & Arrows</p>
          <div className="grid grid-cols-2 gap-2">
            {shapeItems.map((item) => (
              <button
                key={item.type}
                onClick={() => setDrawingMode(drawingMode === item.type ? null : item.type)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-all ${drawingMode === item.type ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-300 hover:bg-cyan-50'}`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                {item.label}
              </button>
            ))}
          </div>
          {drawingMode && (
            <p className="mt-2 text-xs text-cyan-600">Click and drag on canvas to draw</p>
          )}
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
          <strong>Shortcuts:</strong><br />Shift+Drag: Pan<br />Ctrl+A: Select all<br />Ctrl+D: Duplicate<br />Ctrl+V: Paste Image<br />Delete: Remove
        </div>
      </div>
      <div ref={canvasRef} className={`relative flex-1 overflow-hidden ${drawingMode ? 'cursor-crosshair' : ''}`} style={{ background: showGrid ? "repeating-linear-gradient(0deg, transparent, transparent 19px, #e2e8f0 19px, #e2e8f0 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, #e2e8f0 19px, #e2e8f0 20px)" : "#f8fafc" }}
        onMouseDown={handleCanvasMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "0 0" }}>
          {elements.filter(el => !el.parent_id).map((el) => <CanvasElement key={el.id} element={el} isSelected={selectedIds.has(el.id)} isEditing={editingId === el.id} onMouseDown={(e) => handleElementMouseDown(e, el)} onDoubleClick={() => !el.locked && setEditingId(el.id)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, elementId: el.id }); }} onContentChange={async (c) => { setElements((p) => p.map((e) => e.id === el.id ? { ...e, content: c } : e)); await saveElement({ id: el.id, content: c }); }} onEditEnd={() => setEditingId(null)} onColorChange={async (c) => { setElements((p) => p.map((e) => e.id === el.id ? { ...e, color: c } : e)); await saveElement({ id: el.id, color: c }); }} onMetadataChange={async (meta) => { setElements((p) => p.map((e) => e.id === el.id ? { ...e, metadata: { ...e.metadata, ...meta } } : e)); await saveElement({ id: el.id, metadata: { ...el.metadata, ...meta } }); }} onResizeStart={(e, handle) => handleResizeStart(e, el, handle)} onRotateStart={(e) => handleRotateStart(e, el)} isColumnHovered={el.type === 'column' && hoveredColumnId === el.id} dropInsertIndex={el.type === 'column' && hoveredColumnId === el.id ? dropInsertIndex : undefined} columnChildren={el.type === 'column' ? getColumnChildren(el.id) : undefined} onChildContentChange={async (childId, content) => { setElements((p) => p.map((e) => e.id === childId ? { ...e, content } : e)); await saveElement({ id: childId, content }); }} onChildContextMenu={(e, childId) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, elementId: childId }); }} />)}
        </div>
        <input ref={replaceImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleReplaceImage} />
        {contextMenu && (() => {
          const el = elements.find((e) => e.id === contextMenu.elementId);
          const isImage = el?.type === 'image';
          return <div className="fixed z-50 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }}>
            {isImage && (
              <>
                <button onClick={() => { setReplacingImageId(contextMenu.elementId); replaceImageInputRef.current?.click(); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Replace Image
                </button>
                <button onClick={() => { clearImage(contextMenu.elementId); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  Clear Image
                </button>
                <div className="my-1 border-t border-slate-100" />
              </>
            )}
            <button onClick={() => { if (el) duplicateElement(el); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100">Duplicate</button>
            <button onClick={async () => { if (el) { setElements((p) => p.map((e) => e.id === el.id ? { ...e, locked: !e.locked } : e)); await saveElement({ id: el.id, locked: !el.locked }); } setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100">Lock/Unlock</button>
            <div className="my-1 border-t border-slate-100" />
            <p className="px-3 py-1 text-xs font-medium text-slate-400">Arrange</p>
          <button onClick={() => { bringToFront(contextMenu.elementId); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 11V5h14v6M12 5v14M8 19h8" /></svg>
            Bring to Front
          </button>
          <button onClick={() => { bringForward(contextMenu.elementId); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            Bring Forward
          </button>
          <button onClick={() => { sendBackward(contextMenu.elementId); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
            Send Backward
          </button>
          <button onClick={() => { sendToBack(contextMenu.elementId); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13v6h14v-6M12 19V5M8 5h8" /></svg>
            Send to Back
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button onClick={() => { deleteElement(contextMenu.elementId); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50">Delete</button>
          </div>;
        })()}
        
        {/* Floating toolbar for comments and notifications */}
        <div className="fixed top-4 right-4 flex items-center gap-2 z-40">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowComments(false); }}
            className="relative p-2.5 bg-white rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            title="Notifications"
          >
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setShowComments(!showComments); setShowNotifications(false); }}
            className="p-2.5 bg-white rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            title="Comments"
          >
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Comments Panel */}
      <DanoteComments boardId={boardId} isOpen={showComments} onClose={() => setShowComments(false)} />
      
      {/* Notifications Panel */}
      <DanoteNotifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
    </div>
  );
}

// Component for rendering children inside columns with proper styling
function ColumnChildElement({ child, onContentChange, onMetadataChange, onContextMenu }: { 
  child: BoardElement; 
  onContentChange: (c: string) => void; 
  onMetadataChange: (meta: Record<string, any>) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const [isChildEditing, setIsChildEditing] = useState(false);
  
  // Image element
  if (child.type === 'image') {
    return (
      <div className="relative bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden group cursor-pointer hover:ring-2 hover:ring-cyan-300" style={{ minHeight: 80 }} onContextMenu={onContextMenu}>
        {child.content ? (
          <img src={child.content} alt="" className="w-full h-auto object-cover" style={{ maxHeight: 200 }} />
        ) : (
          <div className="flex items-center justify-center h-20 bg-slate-50 text-slate-400 text-xs">No image</div>
        )}
      </div>
    );
  }
  
  // Text header
  if (child.type === 'text-header') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 cursor-pointer hover:ring-2 hover:ring-cyan-300" onDoubleClick={() => setIsChildEditing(true)} onContextMenu={onContextMenu}>
        {isChildEditing ? (
          <input autoFocus type="text" defaultValue={child.content} onBlur={(e) => { onContentChange(e.target.value); setIsChildEditing(false); }} onKeyDown={(e) => e.key === 'Enter' && setIsChildEditing(false)} className="w-full bg-transparent text-xl font-bold text-slate-900 focus:outline-none" />
        ) : (
          <h3 className="text-xl font-bold text-slate-900">{child.content || <span className="text-slate-400">Add header...</span>}</h3>
        )}
      </div>
    );
  }
  
  // Text paragraph
  if (child.type === 'text-paragraph') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 cursor-pointer hover:ring-2 hover:ring-cyan-300" onDoubleClick={() => setIsChildEditing(true)} onContextMenu={onContextMenu}>
        {isChildEditing ? (
          <textarea autoFocus defaultValue={child.content} onBlur={(e) => { onContentChange(e.target.value); setIsChildEditing(false); }} className="w-full bg-transparent text-sm text-slate-700 focus:outline-none resize-none min-h-[60px]" />
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{child.content || <span className="text-slate-400">Add paragraph...</span>}</p>
        )}
      </div>
    );
  }
  
  // Text sentence
  if (child.type === 'text-sentence') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 cursor-pointer hover:ring-2 hover:ring-cyan-300" onDoubleClick={() => setIsChildEditing(true)} onContextMenu={onContextMenu}>
        {isChildEditing ? (
          <input autoFocus type="text" defaultValue={child.content} onBlur={(e) => { onContentChange(e.target.value); setIsChildEditing(false); }} onKeyDown={(e) => e.key === 'Enter' && setIsChildEditing(false)} className="w-full bg-transparent text-sm text-slate-600 focus:outline-none" />
        ) : (
          <span className="text-sm text-slate-600">{child.content || <span className="text-slate-400">Add text...</span>}</span>
        )}
      </div>
    );
  }
  
  // Audio element
  if (child.type === 'audio') {
    const meta = child.metadata || {};
    return (
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg shadow-sm p-3 text-white cursor-pointer hover:ring-2 hover:ring-cyan-300" onContextMenu={onContextMenu}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{child.content || 'Audio Track'}</div>
            <div className="text-xs text-white/70">{meta.duration || '0:00'}</div>
          </div>
        </div>
        <div className="h-1 bg-white/20 rounded-full">
          <div className="h-full w-1/3 bg-white rounded-full" />
        </div>
      </div>
    );
  }
  
  // Note element
  if (child.type === 'note') {
    return (
      <div className="rounded-lg shadow-sm p-3 cursor-pointer hover:ring-2 hover:ring-cyan-300" style={{ backgroundColor: child.color }} onDoubleClick={() => setIsChildEditing(true)} onContextMenu={onContextMenu}>
        {isChildEditing ? (
          <textarea autoFocus defaultValue={child.content} onBlur={(e) => { onContentChange(e.target.value); setIsChildEditing(false); }} className="w-full bg-transparent text-sm text-slate-700 focus:outline-none resize-none min-h-[40px]" />
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{child.content || <span className="text-slate-400">Note...</span>}</p>
        )}
      </div>
    );
  }
  
  // Container element
  if (child.type === 'container') {
    const meta = child.metadata || {};
    return (
      <div className="bg-slate-800 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-cyan-300" onContextMenu={onContextMenu}>
        <div className="px-3 py-2 border-b border-slate-700">
          <div className="text-white font-medium text-sm">{child.content || 'Scene'}</div>
          {meta.subtitle && <div className="text-slate-400 text-xs">{meta.subtitle}</div>}
        </div>
        <div className="h-16 bg-slate-700 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        </div>
      </div>
    );
  }
  
  // Default fallback
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 text-xs text-slate-600">
      <div className="font-medium">{child.type}</div>
      <div className="text-slate-400 truncate">{child.content || 'No content'}</div>
    </div>
  );
}

function CanvasElement({ element, isSelected, isEditing, onMouseDown, onDoubleClick, onContextMenu, onContentChange, onEditEnd, onColorChange, onMetadataChange, onResizeStart, onRotateStart, isColumnHovered, dropInsertIndex, columnChildren, onChildContentChange, onChildContextMenu }: { element: BoardElement; isSelected: boolean; isEditing: boolean; onMouseDown: (e: React.MouseEvent) => void; onDoubleClick: () => void; onContextMenu: (e: React.MouseEvent) => void; onContentChange: (c: string) => void; onEditEnd: () => void; onColorChange: (c: string) => void; onMetadataChange: (meta: Record<string, any>) => void; onResizeStart: (e: React.MouseEvent, handle: string) => void; onRotateStart: (e: React.MouseEvent) => void; isColumnHovered?: boolean; dropInsertIndex?: number; columnChildren?: BoardElement[]; onChildContentChange?: (childId: string, content: string) => void; onChildContextMenu?: (e: React.MouseEvent, childId: string) => void; }) {
  
  const rotation = element.metadata?.rotation ?? 0;
  const isRotatable = ['rectangle', 'circle', 'line', 'arrow', 'image', 'container'].includes(element.type);
  
  // Resize and rotate handles component
  const ResizeHandles = () => {
    if (!isSelected || element.locked) return null;
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    const cursorMap: Record<string, string> = { nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize' };
    const posMap: Record<string, React.CSSProperties> = {
      nw: { top: -4, left: -4 }, n: { top: -4, left: '50%', transform: 'translateX(-50%)' },
      ne: { top: -4, right: -4 }, e: { top: '50%', right: -4, transform: 'translateY(-50%)' },
      se: { bottom: -4, right: -4 }, s: { bottom: -4, left: '50%', transform: 'translateX(-50%)' },
      sw: { bottom: -4, left: -4 }, w: { top: '50%', left: -4, transform: 'translateY(-50%)' }
    };
    return <>
      {handles.map((h) => (
        <div key={h} className="absolute w-2 h-2 bg-white border-2 border-cyan-500 rounded-sm z-50" style={{ ...posMap[h], cursor: cursorMap[h] }} onMouseDown={(e) => onResizeStart(e, h)} />
      ))}
      {/* Rotation handle - appears above the element */}
      {isRotatable && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-500 border-2 border-white rounded-full z-50 cursor-grab" 
          style={{ top: -24 }} 
          onMouseDown={onRotateStart}
          title="Rotate"
        >
          <div className="absolute left-1/2 -translate-x-1/2 w-px h-4 bg-cyan-500" style={{ top: 10 }} />
        </div>
      )}
    </>;
  };
  
  const base: React.CSSProperties = { 
    position: "absolute", 
    left: element.x, 
    top: element.y, 
    width: element.width, 
    height: element.height, 
    zIndex: element.z_index, 
    cursor: element.locked ? "not-allowed" : "grab",
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    transformOrigin: 'center center'
  };
  const sel = isSelected ? "ring-2 ring-cyan-500 ring-offset-2" : "";

  if (element.type === "note") {
    return <div style={{ ...base, backgroundColor: element.color }} className={`rounded-lg shadow-lg ${sel}`} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      {element.locked && <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-white"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg></div>}
      {isEditing ? <textarea autoFocus defaultValue={element.content} onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} onKeyDown={(e) => e.key === "Escape" && onEditEnd()} className="h-full w-full resize-none bg-transparent p-3 text-sm text-slate-700 focus:outline-none" placeholder="Type your note..." />
        : <div className="h-full w-full overflow-auto p-3 text-sm text-slate-700 whitespace-pre-wrap">{element.content || <span className="text-slate-400">Double-click to edit...</span>}</div>}
      {isSelected && <div className="absolute -bottom-8 left-0 flex gap-1">{NOTE_COLORS.map((c) => <button key={c.value} onClick={() => onColorChange(c.value)} className="h-5 w-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: c.value }} />)}</div>}
      <ResizeHandles />
    </div>;
  }

  // Text: Header
  if (element.type === "text-header") {
    return <div style={base} className={sel} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      {isEditing ? <input autoFocus type="text" defaultValue={element.content} onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && onEditEnd()} className="h-full w-full bg-transparent text-2xl font-bold text-black focus:outline-none" placeholder="Add header..." />
        : <div className="text-2xl font-bold text-slate-900">{element.content || <span className="text-slate-400">Double-click to add header...</span>}</div>}
    </div>;
  }

  // Text: Paragraph
  if (element.type === "text-paragraph") {
    return <div style={base} className={sel} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      {isEditing ? <textarea autoFocus defaultValue={element.content} onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} onKeyDown={(e) => e.key === "Escape" && onEditEnd()} className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-black focus:outline-none" placeholder="Add paragraph text..." />
        : <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{element.content || <span className="text-slate-400">Double-click to add paragraph...</span>}</div>}
    </div>;
  }

  // Text: Sentence
  if (element.type === "text-sentence") {
    return <div style={base} className={sel} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      {isEditing ? <input autoFocus type="text" defaultValue={element.content} onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && onEditEnd()} className="h-full w-full bg-transparent text-sm text-black focus:outline-none" placeholder="Add sentence..." />
        : <div className="text-sm text-slate-700">{element.content || <span className="text-slate-400">Double-click to add sentence...</span>}</div>}
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
    return (
      <div style={base} className={`overflow-hidden rounded-lg shadow-lg ${sel}`} onMouseDown={onMouseDown} onContextMenu={onContextMenu}>
        {element.content ? (
          <img src={element.content} alt="Uploaded" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="h-full w-full bg-slate-100 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <svg className="h-10 w-10 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <p className="text-xs">Right-click to add image</p>
            </div>
          </div>
        )}
        <ResizeHandles />
      </div>
    );
  }

  if (element.type === "color-swatch") {
    return <div style={{ ...base, backgroundColor: element.color }} className={`rounded-xl shadow-lg ${sel}`} onMouseDown={onMouseDown} onContextMenu={onContextMenu}>
      <div className="absolute bottom-1 left-1 right-1 rounded bg-black/50 px-2 py-0.5 text-center text-[10px] font-mono text-white">{element.color.toUpperCase()}</div></div>;
  }

  if (element.type === "column") {
    const children = columnChildren || [];
    const headerHeight = 48;
    const padding = 8;
    const childrenHeight = children.reduce((sum, child) => sum + (child.height > 200 ? 100 : child.height) + padding, 0);
    // Use element.height as the primary value, only expand if content requires it
    const minContentHeight = headerHeight + childrenHeight + padding * 2 + 60;
    const dynamicHeight = Math.max(element.height, minContentHeight);
    
    return (
      <div 
        style={{ 
          ...base, 
          height: dynamicHeight, 
          backgroundColor: element.color,
          transition: isColumnHovered ? 'border-color 0.2s, box-shadow 0.2s' : undefined
        }} 
        className={`rounded-2xl border-2 ${isColumnHovered ? 'border-cyan-400 shadow-lg shadow-cyan-100' : 'border-dashed border-slate-300'} ${sel}`} 
        onMouseDown={onMouseDown} 
        onDoubleClick={onDoubleClick} 
        onContextMenu={onContextMenu}
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-4 py-3">
          {isEditing ? (
            <input autoFocus type="text" defaultValue={element.content} onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} className="w-full bg-transparent font-semibold text-slate-700 focus:outline-none" />
          ) : (
            <h3 className="font-semibold text-slate-700">{element.content || "Untitled Column"}</h3>
          )}
        </div>
        
        {/* Children area with flex layout */}
        <div className="p-2 flex flex-col gap-2 min-h-[60px]">
          {children.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-4">
              {isColumnHovered ? '📥 Drop here' : 'Drop cards here'}
            </div>
          ) : (
            children.map((child, idx) => (
              <div key={child.id}>
                {/* Insert indicator */}
                {isColumnHovered && dropInsertIndex === idx && (
                  <div className="h-1 bg-cyan-400 rounded-full mb-2 animate-pulse" />
                )}
                {/* Render child based on type */}
                <ColumnChildElement 
                  child={child} 
                  onContentChange={(c) => onChildContentChange?.(child.id, c)} 
                  onMetadataChange={onMetadataChange}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onChildContextMenu?.(e, child.id); }}
                />
              </div>
            ))
          )}
          {/* Insert indicator at end */}
          {isColumnHovered && dropInsertIndex === children.length && (
            <div className="h-1 bg-cyan-400 rounded-full animate-pulse" />
          )}
        </div>
        <ResizeHandles />
      </div>
    );
  }

  // Container (Scene/Reel card with header and content area)
  if (element.type === "container") {
    const meta = element.metadata || {};
    const subtitle = meta.subtitle || "";
    const location = meta.location || "";
    const camera = meta.camera || "";
    const action = meta.action || "";
    
    return (
      <div 
        style={{ ...base, backgroundColor: element.color }} 
        className={`rounded-2xl border border-slate-200 shadow-lg overflow-hidden ${sel}`} 
        onMouseDown={onMouseDown} 
        onDoubleClick={onDoubleClick} 
        onContextMenu={onContextMenu}
      >
        {/* Header */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-center">
          {isEditing ? (
            <input 
              autoFocus 
              type="text" 
              defaultValue={element.content} 
              onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} 
              className="w-full bg-transparent text-center font-bold text-black focus:outline-none" 
              placeholder="Container Title..."
            />
          ) : (
            <h3 className="font-bold text-slate-900">{element.content || "Untitled Container"}</h3>
          )}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        
        {/* Content area */}
        <div className="p-4 flex-1 min-h-[200px] bg-white">
          {location && (
            <p className="text-xs text-slate-600 mb-2">
              <span className="text-slate-400">Location:</span> {location}
            </p>
          )}
          
          {/* Image placeholder area */}
          <div className="aspect-[4/5] bg-slate-100 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center mb-3">
            <div className="text-center text-slate-400">
              <svg className="h-8 w-8 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <p className="text-xs">Drop image here</p>
            </div>
          </div>
          
          {camera && (
            <p className="text-xs text-slate-600 mb-1">
              <span className="text-slate-400">Camera:</span> {camera}
            </p>
          )}
          {action && (
            <p className="text-xs text-slate-600">
              <span className="text-slate-400">Action:</span> {action}
            </p>
          )}
        </div>
        <ResizeHandles />
      </div>
    );
  }

  // Audio element (Spotify-style embed)
  if (element.type === "audio") {
    const meta = element.metadata || {};
    const audioUrl = meta.url || "";
    const artist = meta.artist || "Unknown Artist";
    
    return (
      <div 
        style={{ ...base, backgroundColor: element.color }} 
        className={`rounded-xl shadow-lg overflow-hidden ${sel}`} 
        onMouseDown={onMouseDown} 
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        <div className="flex items-center gap-3 p-3 h-full">
          {/* Album art placeholder */}
          <div className="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
            <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          
          {/* Track info */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input 
                autoFocus 
                type="text" 
                defaultValue={element.content} 
                onBlur={(e) => { onContentChange(e.target.value); onEditEnd(); }} 
                className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none" 
                placeholder="Track name..."
              />
            ) : (
              <p className="text-sm font-semibold text-white truncate">{element.content || "Audio Track"}</p>
            )}
            <p className="text-xs text-slate-300 truncate">{artist}</p>
            {audioUrl && (
              <a href={audioUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-400 hover:underline truncate block mt-1">
                🔗 {audioUrl.length > 30 ? audioUrl.substring(0, 30) + '...' : audioUrl}
              </a>
            )}
          </div>
          
          {/* Play button */}
          <button className="w-10 h-10 flex-shrink-0 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center transition-colors">
            <svg className="h-5 w-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Shape: Rectangle
  if (element.type === "rectangle") {
    const fillColor = element.metadata?.fillColor ?? element.color;
    const strokeColor = element.metadata?.strokeColor ?? 'transparent';
    const strokeWidth = element.metadata?.strokeWidth ?? 2;
    
    return (
      <div 
        style={{ 
          ...base, 
          backgroundColor: fillColor,
          border: strokeColor !== 'transparent' ? `${strokeWidth}px solid ${strokeColor}` : 'none',
          boxSizing: 'border-box'
        }} 
        className={`rounded-md ${sel}`} 
        onMouseDown={onMouseDown} 
        onContextMenu={onContextMenu}
      >
        {isSelected && (
          <div className="absolute -bottom-16 left-0 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-medium text-slate-500 w-10">Fill:</span>
              <div className="flex gap-1">
                {SHAPE_COLORS.map((c) => (
                  <button key={c.value} onClick={() => onMetadataChange({ fillColor: c.value })} className={`h-4 w-4 rounded-full border ${fillColor === c.value ? 'ring-2 ring-cyan-500 ring-offset-1' : 'border-slate-300'}`} style={{ backgroundColor: c.value === 'transparent' ? 'white' : c.value, backgroundImage: c.value === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none', backgroundSize: '6px 6px', backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px' }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500 w-10">Stroke:</span>
              <div className="flex gap-1">
                {SHAPE_COLORS.map((c) => (
                  <button key={c.value} onClick={() => onMetadataChange({ strokeColor: c.value })} className={`h-4 w-4 rounded-full border ${strokeColor === c.value ? 'ring-2 ring-cyan-500 ring-offset-1' : 'border-slate-300'}`} style={{ backgroundColor: c.value === 'transparent' ? 'white' : c.value, backgroundImage: c.value === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none', backgroundSize: '6px 6px', backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px' }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Shape: Circle
  if (element.type === "circle") {
    const fillColor = element.metadata?.fillColor ?? element.color;
    const strokeColor = element.metadata?.strokeColor ?? 'transparent';
    const strokeWidth = element.metadata?.strokeWidth ?? 2;
    
    return (
      <div 
        style={{ 
          ...base, 
          backgroundColor: fillColor, 
          borderRadius: '50%',
          border: strokeColor !== 'transparent' ? `${strokeWidth}px solid ${strokeColor}` : 'none',
          boxSizing: 'border-box'
        }} 
        className={sel} 
        onMouseDown={onMouseDown} 
        onContextMenu={onContextMenu}
      >
        {isSelected && (
          <div className="absolute -bottom-16 left-0 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-medium text-slate-500 w-10">Fill:</span>
              <div className="flex gap-1">
                {SHAPE_COLORS.map((c) => (
                  <button key={c.value} onClick={() => onMetadataChange({ fillColor: c.value })} className={`h-4 w-4 rounded-full border ${fillColor === c.value ? 'ring-2 ring-cyan-500 ring-offset-1' : 'border-slate-300'}`} style={{ backgroundColor: c.value === 'transparent' ? 'white' : c.value, backgroundImage: c.value === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none', backgroundSize: '6px 6px', backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px' }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500 w-10">Stroke:</span>
              <div className="flex gap-1">
                {SHAPE_COLORS.map((c) => (
                  <button key={c.value} onClick={() => onMetadataChange({ strokeColor: c.value })} className={`h-4 w-4 rounded-full border ${strokeColor === c.value ? 'ring-2 ring-cyan-500 ring-offset-1' : 'border-slate-300'}`} style={{ backgroundColor: c.value === 'transparent' ? 'white' : c.value, backgroundImage: c.value === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none', backgroundSize: '6px 6px', backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px' }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Shape: Line
  if (element.type === "line") {
    const meta = element.metadata || {};
    const startX = meta.startX ?? element.x;
    const startY = meta.startY ?? element.y;
    const endX = meta.endX ?? (element.x + element.width);
    const endY = meta.endY ?? element.y;
    const strokeColor = meta.strokeColor ?? element.color;
    const strokeWidth = meta.strokeWidth ?? 3;
    
    // Calculate SVG viewport
    const minX = Math.min(startX, endX);
    const minY = Math.min(startY, endY);
    const svgWidth = Math.max(Math.abs(endX - startX), 10);
    const svgHeight = Math.max(Math.abs(endY - startY), 10);
    
    return (
      <div 
        style={{ 
          position: 'absolute', 
          left: minX, 
          top: minY, 
          width: svgWidth, 
          height: svgHeight, 
          zIndex: element.z_index,
          cursor: element.locked ? "not-allowed" : "grab",
          padding: 8,
          margin: -8
        }} 
        className={sel}
        onMouseDown={onMouseDown} 
        onContextMenu={onContextMenu}
      >
        <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible' }}>
          <line 
            x1={startX - minX} 
            y1={startY - minY} 
            x2={endX - minX} 
            y2={endY - minY} 
            stroke={strokeColor} 
            strokeWidth={strokeWidth} 
            strokeLinecap="round"
          />
        </svg>
        {isSelected && (
          <div className="absolute -bottom-12 left-0 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500 w-10">Color:</span>
              <div className="flex gap-1">
                {SHAPE_COLORS.filter(c => c.value !== 'transparent').map((c) => (
                  <button key={c.value} onClick={() => onMetadataChange({ strokeColor: c.value })} className={`h-4 w-4 rounded-full border ${strokeColor === c.value ? 'ring-2 ring-cyan-500 ring-offset-1' : 'border-slate-300'}`} style={{ backgroundColor: c.value }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Shape: Arrow
  if (element.type === "arrow") {
    const meta = element.metadata || {};
    const startX = meta.startX ?? element.x;
    const startY = meta.startY ?? element.y;
    const endX = meta.endX ?? (element.x + element.width);
    const endY = meta.endY ?? element.y;
    const strokeColor = meta.strokeColor ?? element.color;
    const strokeWidth = meta.strokeWidth ?? 3;
    
    // Calculate SVG viewport with padding for arrowhead
    const padding = 16;
    const minX = Math.min(startX, endX) - padding;
    const minY = Math.min(startY, endY) - padding;
    const svgWidth = Math.abs(endX - startX) + padding * 2;
    const svgHeight = Math.abs(endY - startY) + padding * 2;
    
    // Calculate arrowhead points
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = 12;
    const arrowAngle = Math.PI / 6;
    
    const arrow1X = endX - arrowLength * Math.cos(angle - arrowAngle);
    const arrow1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
    const arrow2X = endX - arrowLength * Math.cos(angle + arrowAngle);
    const arrow2Y = endY - arrowLength * Math.sin(angle + arrowAngle);
    
    return (
      <div 
        style={{ 
          position: 'absolute', 
          left: minX, 
          top: minY, 
          width: svgWidth, 
          height: svgHeight, 
          zIndex: element.z_index,
          cursor: element.locked ? "not-allowed" : "grab"
        }} 
        className={sel}
        onMouseDown={onMouseDown} 
        onContextMenu={onContextMenu}
      >
        <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible' }}>
          <line 
            x1={startX - minX + padding} 
            y1={startY - minY + padding} 
            x2={endX - minX + padding} 
            y2={endY - minY + padding} 
            stroke={strokeColor} 
            strokeWidth={strokeWidth} 
            strokeLinecap="round"
          />
          <polygon 
            points={`${endX - minX + padding},${endY - minY + padding} ${arrow1X - minX + padding},${arrow1Y - minY + padding} ${arrow2X - minX + padding},${arrow2Y - minY + padding}`}
            fill={strokeColor}
          />
        </svg>
        {isSelected && (
          <div className="absolute -bottom-12 left-0 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500 w-10">Color:</span>
              <div className="flex gap-1">
                {SHAPE_COLORS.filter(c => c.value !== 'transparent').map((c) => (
                  <button key={c.value} onClick={() => onMetadataChange({ strokeColor: c.value })} className={`h-4 w-4 rounded-full border ${strokeColor === c.value ? 'ring-2 ring-cyan-500 ring-offset-1' : 'border-slate-300'}`} style={{ backgroundColor: c.value }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
