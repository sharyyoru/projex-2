"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useProjectActivityFeed } from "./ProjectActivityFeed";
import ProjectDocumentsTab from "./ProjectDocumentsTab";
import FilePreviewModal from "@/components/FilePreviewModal";

type Note = {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string;
};

type TaskStatus = "not_started" | "in_progress" | "completed";

type TaskPriority = "low" | "medium" | "high";

type TaskType = "todo" | "call" | "email" | "other";

type Task = {
  id: string;
  project_id: string | null;
  name: string;
  content: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  activity_date: string | null;
  created_by_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  created_at: string;
};

type TaskChecklistItem = {
  id: string;
  task_id: string;
  label: string;
  is_completed: boolean;
  sort_order: number;
};

type UserSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function formatTaskStatusLabel(status: TaskStatus | null | undefined): string {
  if (!status) return "";
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  return "Completed";
}

function taskStatusPillClasses(status: TaskStatus | null | undefined): string {
  if (status === "not_started") {
    return "border border-red-200 bg-red-50 text-red-700";
  }
  if (status === "in_progress") {
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "completed") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border border-slate-200 bg-slate-50 text-slate-600";
}

function matchesAnyText(
  values: (string | null | undefined)[],
  filter: string,
): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  for (const value of values) {
    if (
      (value ?? "")
        .toString()
        .toLowerCase()
        .includes(needle)
    ) {
      return true;
    }
  }
  return false;
}

function isWithinDateRange(
  isoDate: string | null,
  fromDate: string,
  toDate: string,
): boolean {
  if (!fromDate && !toDate) return true;
  if (!isoDate) return false;
  const day = isoDate.slice(0, 10);
  if (fromDate && day < fromDate) return false;
  if (toDate && day > toDate) return false;
  return true;
}

export default function ProjectNotesTasksCard({
  projectId,
}: {
  projectId: string;
}) {
  const [activeTab, setActiveTab] =
    useState<"activity" | "notes" | "tasks" | "files" | "links">("activity");
  
  // Links state
  const [links, setLinks] = useState<{ id: string; url: string; title: string; created_at: string }[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [taskName, setTaskName] = useState("");
  const [taskContent, setTaskContent] = useState("");
  const [taskActivityDate, setTaskActivityDate] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskSaveError, setTaskSaveError] = useState<string | null>(null);

  const [checklistEnabled, setChecklistEnabled] = useState(false);
  const [checklistText, setChecklistText] = useState("");

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  
  // Kanban view state
  const [taskViewMode, setTaskViewMode] = useState<"list" | "kanban">("list");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [checklistByTaskId, setChecklistByTaskId] = useState<
    Record<string, TaskChecklistItem[]>
  >({});

  const [filterText, setFilterText] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterSortOrder, setFilterSortOrder] = useState<"desc" | "asc">(
    "desc",
  );
  const [taskUserFilterUserId, setTaskUserFilterUserId] = useState<string | null>(
    null,
  );
  const [taskUserFilterOpen, setTaskUserFilterOpen] = useState(false);
  const [taskUserFilterSearch, setTaskUserFilterSearch] = useState("");

  const [selectedTaskGroup, setSelectedTaskGroup] = useState<
    | {
        key: string;
        primaryTaskId: string | null;
        name: string;
        content: string | null;
        activity_date: string | null;
        priority: TaskPriority;
        created_by_name: string | null;
        created_at: string;
        statuses: TaskStatus[];
        assignedNames: string[];
        taskIds: string[];
        checklistItems: TaskChecklistItem[];
      }
    | null
  >(null);

  const [activityReloadKey, setActivityReloadKey] = useState(0);
  const [isEditingTask, setIsEditingTask] = useState(false);
  
  // File preview state
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [filePreviewName, setFilePreviewName] = useState("");
  const [statusDropdownOpenKey, setStatusDropdownOpenKey] = useState<string | null>(
    null,
  );
  const [modalStatusDropdownOpen, setModalStatusDropdownOpen] = useState(false);

  const selectedTaskAllCompleted =
    selectedTaskGroup?.statuses.every((status) => status === "completed") ??
    false;
  const selectedTaskAnyInProgress =
    selectedTaskGroup?.statuses.some((status) => status === "in_progress") ??
    false;
  const selectedTaskDisplayStatus: TaskStatus | null = selectedTaskGroup
    ? selectedTaskAllCompleted
      ? "completed"
      : selectedTaskAnyInProgress
      ? "in_progress"
      : "not_started"
    : null;

  const normalizedFilter = filterText.trim().toLowerCase();

  const {
    items: activityItems,
    loading: activityLoading,
    error: activityError,
    hasItems: activityHasItems,
  } = useProjectActivityFeed(projectId, {
    includeDeals: false,
    includeInvoices: false,
    reloadKey: activityReloadKey,
  });

  const activityItemsWithoutDeals = activityItems.filter(
    (item) => item.kind !== "deal",
  );
  const collapsedActivityItems = (() => {
    const result: typeof activityItems = [];
    const seenTaskKeys = new Set<string>();

    for (const item of activityItemsWithoutDeals) {
      if (item.kind !== "task") {
        result.push(item);
        continue;
      }

      const key = [
        item.title,
        item.body ?? "",
        item.meta,
        item.at ?? "",
      ].join("||");

      if (seenTaskKeys.has(key)) continue;
      seenTaskKeys.add(key);
      result.push(item);
    }

    return result;
  })();

  const activityHasItemsWithoutDeals = collapsedActivityItems.length > 0;

  const filteredActivityItems = collapsedActivityItems.filter((item) => {
    if (!isWithinDateRange(item.at ?? null, filterFromDate, filterToDate)) {
      return false;
    }

    if (!normalizedFilter) return true;

    return matchesAnyText(
      [item.title, item.body ?? null, item.meta, item.kind],
      normalizedFilter,
    );
  });

  const orderedActivityItems =
    filterSortOrder === "desc"
      ? filteredActivityItems
      : [...filteredActivityItems].slice().reverse();

  useEffect(() => {
    let isMounted = true;

    async function loadNotes() {
      try {
        setNotesLoading(true);
        setNotesError(null);

        const { data, error } = await supabaseClient
          .from("project_notes")
          .select("id, body, author_name, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (!isMounted) return;

        if (error || !data) {
          setNotesError(error?.message ?? "Failed to load notes.");
          setNotes([]);
        } else {
          setNotes(data as Note[]);
        }
      } catch {
        if (!isMounted) return;
        setNotesError("Failed to load notes.");
        setNotes([]);
      } finally {
        if (isMounted) setNotesLoading(false);
      }
    }

    void loadNotes();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      try {
        setUsersLoading(true);
        setUsersError(null);

        const { data, error } = await supabaseClient
          .from("users")
          .select("id, full_name, email")
          .order("full_name", { ascending: true });

        if (!isMounted) return;

        if (error || !data) {
          setUsersError(error?.message ?? "Failed to load users.");
          setUsers([]);
        } else {
          setUsers(data as UserSummary[]);
        }
      } catch {
        if (!isMounted) return;
        setUsersError("Failed to load users.");
        setUsers([]);
      } finally {
        if (isMounted) setUsersLoading(false);
      }
    }

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadTasks() {
      try {
        setTasksLoading(true);
        setTasksError(null);

        const { data, error } = await supabaseClient
          .from("tasks")
          .select(
            "id, project_id, name, content, status, priority, type, activity_date, created_by_name, assigned_user_id, assigned_user_name, created_at",
          )
          .eq("project_id", projectId)
          .order("activity_date", { ascending: false });

        if (!isMounted) return;

        if (error || !data) {
          setTasksError(error?.message ?? "Failed to load tasks.");
          setTasks([]);
          setChecklistByTaskId({});
        } else {
          const rows = data as Task[];
          setTasks(rows);

          const taskIds = rows.map((row) => row.id);
          if (taskIds.length === 0) {
            setChecklistByTaskId({});
          } else {
            const { data: checklistData, error: checklistError } =
              await supabaseClient
                .from("task_checklist_items")
                .select(
                  "id, task_id, label, is_completed, sort_order",
                )
                .in("task_id", taskIds)
                .order("sort_order", { ascending: true });

            if (!isMounted) return;

            if (checklistError || !checklistData) {
              setChecklistByTaskId({});
            } else {
              const map: Record<string, TaskChecklistItem[]> = {};
              for (const row of checklistData as any[]) {
                const taskId = row.task_id as string;
                if (!map[taskId]) map[taskId] = [];
                map[taskId].push({
                  id: row.id as string,
                  task_id: taskId,
                  label: (row.label as string | null) ?? "",
                  is_completed: (row.is_completed as boolean | null) ?? false,
                  sort_order: (row.sort_order as number | null) ?? 0,
                });
              }
              setChecklistByTaskId(map);
            }
          }
        }
      } catch {
        if (!isMounted) return;
        setTasksError("Failed to load tasks.");
        setTasks([]);
        setChecklistByTaskId({});
      } finally {
        if (isMounted) setTasksLoading(false);
      }
    }

    void loadTasks();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  async function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = noteBody.trim();
    if (!trimmed) {
      setNoteSaveError("Note cannot be empty.");
      return;
    }

    try {
      setNoteSaving(true);
      setNoteSaveError(null);

      const { data: authData } = await supabaseClient.auth.getUser();
      const authUser = authData?.user;
      if (!authUser) {
        setNoteSaveError("You must be logged in to create a note.");
        setNoteSaving(false);
        return;
      }

      const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
      const first = (meta["first_name"] as string) || "";
      const last = (meta["last_name"] as string) || "";
      const fullName =
        [first, last].filter(Boolean).join(" ") || authUser.email || null;

      const { data, error } = await supabaseClient
        .from("project_notes")
        .insert({
          project_id: projectId,
          author_user_id: authUser.id,
          author_name: fullName,
          body: trimmed,
        })
        .select("id, body, author_name, created_at")
        .single();

      if (error || !data) {
        setNoteSaveError(error?.message ?? "Failed to save note.");
        setNoteSaving(false);
        return;
      }

      setNotes((prev) => [data as Note, ...prev]);
      setNoteBody("");
      setNoteSaving(false);
      setActivityReloadKey((previous) => previous + 1);
    } catch {
      setNoteSaveError("Unexpected error saving note.");
      setNoteSaving(false);
    }
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = taskName.trim();
    const content = taskContent.trim();

    const checklistLabels = checklistEnabled
      ? checklistText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      : [];

    if (!name) {
      setTaskSaveError("Task name is required.");
      return;
    }

    try {
      setTaskSaving(true);
      setTaskSaveError(null);

      const { data: authData } = await supabaseClient.auth.getUser();
      const authUser = authData?.user;
      if (!authUser) {
        setTaskSaveError("You must be logged in to create a task.");
        setTaskSaving(false);
        return;
      }

      const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
      const first = (meta["first_name"] as string) || "";
      const last = (meta["last_name"] as string) || "";
      const fullName =
        [first, last].filter(Boolean).join(" ") || authUser.email || null;
      const targetAssigneeIds =
        selectedAssigneeIds.length > 0 ? selectedAssigneeIds : [authUser.id];

      const rowsToInsert = targetAssigneeIds.map((assigneeId) => {
        const user = users.find((u) => u.id === assigneeId);
        const assigneeName =
          (user?.full_name as string | null) ||
          (user?.email as string | null) ||
          (assigneeId === authUser.id ? fullName : null);

        return {
          project_id: projectId,
          name,
          content: content || null,
          status: "not_started" satisfies TaskStatus,
          priority: taskPriority,
          type: "todo" satisfies TaskType,
          activity_date: taskActivityDate || null,
          created_by_user_id: authUser.id,
          created_by_name: fullName,
          assigned_user_id: assigneeId,
          assigned_user_name: assigneeName,
        };
      });

      const { data, error } = await supabaseClient
        .from("tasks")
        .insert(rowsToInsert)
        .select(
          "id, project_id, name, content, status, priority, type, activity_date, created_by_name, assigned_user_id, assigned_user_name, created_at",
        );

      if (error || !data) {
        setTaskSaveError(error?.message ?? "Failed to save task.");
        setTaskSaving(false);
        return;
      }

      const insertedTasks = data as Task[];

      if (checklistLabels.length > 0) {
        try {
          const checklistRows: {
            task_id: string;
            label: string;
            sort_order: number;
          }[] = [];

          for (const task of insertedTasks) {
            checklistLabels.forEach((label, index) => {
              checklistRows.push({
                task_id: task.id,
                label,
                sort_order: index,
              });
            });
          }

          const { data: checklistData, error: checklistError } =
            await supabaseClient
              .from("task_checklist_items")
              .insert(checklistRows)
              .select("id, task_id, label, is_completed, sort_order");

          if (!checklistError && checklistData) {
            setChecklistByTaskId((prev) => {
              const next: Record<string, TaskChecklistItem[]> = { ...prev };
              for (const row of checklistData as any[]) {
                const taskId = row.task_id as string;
                const existing = next[taskId] ? [...next[taskId]] : [];
                existing.push({
                  id: row.id as string,
                  task_id: taskId,
                  label: (row.label as string | null) ?? "",
                  is_completed:
                    (row.is_completed as boolean | null) ?? false,
                  sort_order: (row.sort_order as number | null) ?? 0,
                });
                next[taskId] = existing;
              }
              return next;
            });
          }
        } catch {
          // Ignore checklist persistence errors so main task creation still succeeds.
        }
      }

      setTasks((prev) => [...insertedTasks, ...prev]);
      setTaskName("");
      setTaskContent("");
      setTaskActivityDate("");
      setTaskPriority("medium");
      setChecklistEnabled(false);
      setChecklistText("");
      setSelectedAssigneeIds([]);
      setIsTaskModalOpen(false);
      setTaskSaving(false);
      setActivityReloadKey((previous) => previous + 1);
    } catch {
      setTaskSaveError("Unexpected error saving task.");
      setTaskSaving(false);
    }
  }

  async function handleMarkTasksCompleted(taskIds: string[]) {
    const targetIds = tasks
      .filter((task) => taskIds.includes(task.id) && task.status !== "completed")
      .map((task) => task.id);

    if (targetIds.length === 0) return;

    try {
      const { data, error } = await supabaseClient
        .from("tasks")
        .update({ status: "completed" satisfies TaskStatus })
        .in("id", targetIds)
        .select(
          "id, project_id, name, content, status, priority, type, activity_date, created_by_name, assigned_user_id, assigned_user_name, created_at",
        );

      if (error || !data) return;

      const updatedById = new Map<string, Task>();
      for (const row of data as Task[]) {
        updatedById.set(row.id, row);
      }

      setTasks((prev) => prev.map((row) => updatedById.get(row.id) ?? row));
      setActivityReloadKey((previous) => previous + 1);
    } catch {
      // ignore
    }
  }

  async function handleToggleChecklistItem(item: TaskChecklistItem) {
    try {
      const nextCompleted = !item.is_completed;

      const { error } = await supabaseClient
        .from("task_checklist_items")
        .update({ is_completed: nextCompleted })
        .eq("id", item.id);

      if (error) return;

      setChecklistByTaskId((prev) => {
        const next: Record<string, TaskChecklistItem[]> = { ...prev };
        const current = next[item.task_id];
        if (!current) return prev;
        next[item.task_id] = current.map((row) =>
          row.id === item.id ? { ...row, is_completed: nextCompleted } : row,
        );
        return next;
      });

      setSelectedTaskGroup((prev) => {
        if (!prev) return prev;
        if (!prev.checklistItems.some((row) => row.id === item.id)) return prev;
        return {
          ...prev,
          checklistItems: prev.checklistItems.map((row) =>
            row.id === item.id ? { ...row, is_completed: nextCompleted } : row,
          ),
        };
      });
    } catch {
      // ignore toggle errors
    }
  }

  async function handleChangeTaskStatus(
    taskIds: string[],
    status: TaskStatus,
  ) {
    const targetIds = tasks
      .filter((task) => taskIds.includes(task.id) && task.status !== status)
      .map((task) => task.id);

    if (targetIds.length === 0) return;

    try {
      const { data, error } = await supabaseClient
        .from("tasks")
        .update({ status })
        .in("id", targetIds)
        .select(
          "id, project_id, name, content, status, priority, type, activity_date, created_by_name, assigned_user_id, assigned_user_name, created_at",
        );

      if (error || !data) return;

      const updatedById = new Map<string, Task>();
      for (const row of data as Task[]) {
        updatedById.set(row.id, row);
      }

      setTasks((prev) => prev.map((row) => updatedById.get(row.id) ?? row));
      setActivityReloadKey((previous) => previous + 1);

      setSelectedTaskGroup((prev) => {
        if (!prev) return prev;
        const hasOverlap = prev.taskIds.some((id) => targetIds.includes(id));
        if (!hasOverlap) return prev;
        const nextStatuses = prev.statuses.map((current, index) =>
          targetIds.includes(prev.taskIds[index]) ? status : current,
        );
        return { ...prev, statuses: nextStatuses };
      });
    } catch {
      // ignore status update errors
    }
  }

  function openTaskFromActivity(taskId: string) {
    const task = tasks.find((row) => row.id === taskId);
    if (!task) return;

    const assignedLabel = task.assigned_user_name ? [task.assigned_user_name] : [];
    const checklistItems = checklistByTaskId[task.id] ?? [];

    setIsEditingTask(false);
    setSelectedTaskGroup({
      key: task.id,
      primaryTaskId: task.id,
      name: task.name,
      content: task.content,
      activity_date: task.activity_date,
      priority: task.priority,
      created_by_name: task.created_by_name,
      created_at: task.created_at,
      statuses: [task.status],
      assignedNames: assignedLabel,
      taskIds: [task.id],
      checklistItems,
    });
  }

  function extractFileNameFromBody(body: string | null): string | null {
    if (!body) return null;
    // Match: Uploaded file "filename.ext"
    const singleMatch = body.match(/^Uploaded file "([^"]+)"/);
    if (singleMatch) return singleMatch[1];
    // Match: Uploaded N files to the project files: "file1", "file2"
    const multiMatch = body.match(/files to the project files: "([^"]+)"/);
    if (multiMatch) return multiMatch[1];
    return null;
  }

  function openFileFromActivity(body: string | null) {
    const fileName = extractFileNameFromBody(body);
    if (!fileName) return;
    
    const { data } = supabaseClient.storage
      .from("project-documents")
      .getPublicUrl(`${projectId}/${fileName}`);
    
    if (data.publicUrl) {
      setFilePreviewUrl(data.publicUrl);
      setFilePreviewName(fileName);
      setFilePreviewOpen(true);
    }
  }

  async function handleUpdateTaskDetails() {
    if (!selectedTaskGroup) return;

    const name = taskName.trim();
    const content = taskContent.trim();

    if (!name) {
      setTaskSaveError("Task name is required.");
      return;
    }

    try {
      setTaskSaving(true);
      setTaskSaveError(null);

      const { data, error } = await supabaseClient
        .from("tasks")
        .update({
          name,
          content: content || null,
          activity_date: taskActivityDate || null,
          priority: taskPriority,
        })
        .in("id", selectedTaskGroup.taskIds)
        .select(
          "id, project_id, name, content, status, priority, type, activity_date, created_by_name, assigned_user_id, assigned_user_name, created_at",
        );

      if (error || !data) {
        setTaskSaveError(error?.message ?? "Failed to update task.");
        setTaskSaving(false);
        return;
      }

      const updatedRows = data as Task[];
      const updatedById = new Map<string, Task>();
      for (const row of updatedRows) {
        updatedById.set(row.id, row);
      }

      setTasks((prev) => prev.map((row) => updatedById.get(row.id) ?? row));

      setSelectedTaskGroup((prev) =>
        prev
          ? {
              ...prev,
              name,
              content: content || null,
              activity_date: taskActivityDate || null,
              priority: taskPriority,
            }
          : prev,
      );

      setIsEditingTask(false);
      setTaskSaving(false);
    } catch {
      setTaskSaveError("Unexpected error updating task.");
      setTaskSaving(false);
    }
  }

  const filteredNotes = notes.filter((note) => {
    if (!isWithinDateRange(note.created_at, filterFromDate, filterToDate)) {
      return false;
    }

    if (!normalizedFilter) return true;

    return matchesAnyText(
      [note.body, note.author_name],
      normalizedFilter,
    );
  });

  const orderedNotes =
    filterSortOrder === "desc"
      ? filteredNotes
      : [...filteredNotes].slice().reverse();

  const taskUserFilterLabel = (() => {
    if (!taskUserFilterUserId) return "All users";
    const user = users.find((row) => row.id === taskUserFilterUserId);
    if (!user) return "All users";
    return (
      user.full_name ||
      user.email ||
      "Selected user"
    );
  })();

  const filteredTaskFilterUsers = (() => {
    const search = taskUserFilterSearch.trim();
    if (!search) return users;
    return users.filter((user) =>
      matchesAnyText([user.full_name, user.email], search),
    );
  })();

  function handleClearFilters() {
    setFilterText("");
    setFilterFromDate("");
    setFilterToDate("");
    setFilterSortOrder("desc");
    setTaskUserFilterUserId(null);
    setTaskUserFilterSearch("");
    setTaskUserFilterOpen(false);
  }

  // Kanban drag-and-drop handlers
  async function handleTaskDrop(taskId: string, newStatus: TaskStatus) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    setDraggedTaskId(null);

    try {
      const { error } = await supabaseClient
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) {
        // Revert on error - reload tasks
        console.error("Failed to update task status:", error);
      }
    } catch (e) {
      console.error("Error updating task status:", e);
    }
  }

  const tasksByStatus = {
    not_started: tasks.filter((t) => t.status === "not_started"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    completed: tasks.filter((t) => t.status === "completed"),
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Project Activities</h2>
          <p className="text-[11px] text-slate-500">
            {activeTab === "activity"
              ? "Notes and tasks for this project."
              : activeTab === "notes"
              ? "Capture internal notes for this project."
              : activeTab === "tasks"
              ? "Plan and track follow-up tasks for this project."
              : activeTab === "files"
              ? "Store and access files for this project."
              : "Save and organize useful links for this project."}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/80 p-0.5 text-[11px] text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={
              "group inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-all " +
              (activeTab === "activity"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25"
                : "hover:bg-slate-100 hover:text-slate-900")
            }
          >
            <svg 
              className={`h-3.5 w-3.5 transition-transform ${activeTab === "activity" ? "animate-pulse" : "group-hover:scale-110"}`}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={
              "group inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-all " +
              (activeTab === "notes"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25"
                : "hover:bg-slate-100 hover:text-slate-900")
            }
          >
            <svg 
              className={`h-3.5 w-3.5 transition-transform ${activeTab === "notes" ? "animate-bounce" : "group-hover:rotate-6"}`}
              style={activeTab === "notes" ? { animationDuration: "2s" } : undefined}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Notes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={
              "group inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-all " +
              (activeTab === "tasks"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                : "hover:bg-slate-100 hover:text-slate-900")
            }
          >
            <svg 
              className={`h-3.5 w-3.5 transition-transform ${activeTab === "tasks" ? "" : "group-hover:scale-110"}`}
              style={activeTab === "tasks" ? { animation: "checkPop 0.6s ease-in-out infinite" } : undefined}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("files")}
            className={
              "group inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-all " +
              (activeTab === "files"
                ? "bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/25"
                : "hover:bg-slate-100 hover:text-slate-900")
            }
          >
            <svg 
              className={`h-3.5 w-3.5 transition-transform ${activeTab === "files" ? "" : "group-hover:-translate-y-0.5"}`}
              style={activeTab === "files" ? { animation: "float 2s ease-in-out infinite" } : undefined}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Files
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("links")}
            className={
              "group inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-all " +
              (activeTab === "links"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/25"
                : "hover:bg-slate-100 hover:text-slate-900")
            }
          >
            <svg 
              className={`h-3.5 w-3.5 transition-transform ${activeTab === "links" ? "" : "group-hover:rotate-12"}`}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Links
          </button>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white/80 p-3 shadow-sm backdrop-blur">
        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 text-violet-500">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            type="text"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Search notes, tasks, files..."
            className="h-8 w-48 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-900 shadow-sm transition-all focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 rounded-lg bg-white/60 px-2 py-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-100 to-orange-100 text-amber-500">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <input
            type="date"
            value={filterFromDate}
            onChange={(event) => setFilterFromDate(event.target.value)}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
          />
          <span className="text-[10px] text-slate-400">→</span>
          <input
            type="date"
            value={filterToDate}
            onChange={(event) => setFilterToDate(event.target.value)}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
          />
        </div>

        {/* Sort Order */}
        <button
          type="button"
          onClick={() =>
            setFilterSortOrder((previous) =>
              previous === "desc" ? "asc" : "desc",
            )
          }
          className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition-all hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${filterSortOrder === "asc" ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 16 4 4 4-4" />
            <path d="M7 20V4" />
            <path d="m21 8-4-4-4 4" />
            <path d="M17 4v16" />
          </svg>
          {filterSortOrder === "desc" ? "Newest" : "Oldest"}
        </button>

        {/* Clear Filters */}
        {(filterText || filterFromDate || filterToDate) && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 transition-all hover:bg-red-100"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {activeTab === "activity" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Notes and tasks for this project.
            </p>
            <p className="text-[11px] text-slate-400">
              {orderedActivityItems.length} entries
            </p>
          </div>

          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" />
                <p className="text-[12px] font-medium text-slate-500">Loading activity…</p>
              </div>
            </div>
          ) : activityError ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6M9 9l6 6" />
              </svg>
              <p className="text-[11px] text-red-600">{activityError}</p>
            </div>
          ) : !activityHasItemsWithoutDeals ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white py-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-400">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <p className="mt-3 text-[13px] font-medium text-slate-600">No activity yet</p>
              <p className="mt-1 text-[11px] text-slate-400">Notes, tasks, and files will appear here</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-violet-300 via-slate-200 to-transparent" />
              
              {orderedActivityItems.map((item, index) => {
                const iconBg = item.kind === "note"
                  ? "from-amber-400 to-orange-500 shadow-amber-500/30"
                  : item.kind === "task"
                  ? "from-emerald-400 to-teal-500 shadow-emerald-500/30"
                  : item.kind === "invoice"
                  ? "from-sky-400 to-blue-500 shadow-sky-500/30"
                  : item.kind === "file"
                  ? "from-purple-400 to-violet-500 shadow-violet-500/30"
                  : "from-pink-400 to-rose-500 shadow-pink-500/30";

                const cardBg = item.kind === "note"
                  ? "from-amber-50/80 to-orange-50/50 border-amber-200/60 hover:border-amber-300"
                  : item.kind === "task"
                  ? "from-emerald-50/80 to-teal-50/50 border-emerald-200/60 hover:border-emerald-300"
                  : item.kind === "invoice"
                  ? "from-sky-50/80 to-blue-50/50 border-sky-200/60 hover:border-sky-300"
                  : item.kind === "file"
                  ? "from-purple-50/80 to-violet-50/50 border-purple-200/60 hover:border-purple-300"
                  : "from-pink-50/80 to-rose-50/50 border-pink-200/60 hover:border-pink-300";

                return (
                  <div
                    key={item.id}
                    className={`group relative flex gap-3 pb-3 ${index === orderedActivityItems.length - 1 ? "pb-0" : ""}`}
                  >
                    {/* Timeline icon */}
                    <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${iconBg} text-white shadow-lg transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl`}>
                      {item.kind === "note" ? (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      ) : item.kind === "task" ? (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      ) : item.kind === "invoice" ? (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <path d="M2 10h20" />
                        </svg>
                      ) : item.kind === "file" ? (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                      )}
                    </div>

                    {/* Activity card */}
                    <div
                      className={`flex-1 rounded-xl border bg-gradient-to-r ${cardBg} p-3 shadow-sm transition-all duration-200 hover:shadow-md ${item.kind === "task" || item.kind === "file" ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (item.kind === "task" && item.taskId) {
                          openTaskFromActivity(item.taskId);
                        } else if (item.kind === "file") {
                          openFileFromActivity(item.body);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              item.kind === "note" ? "bg-amber-500/10 text-amber-700" :
                              item.kind === "task" ? "bg-emerald-500/10 text-emerald-700" :
                              item.kind === "invoice" ? "bg-sky-500/10 text-sky-700" :
                              item.kind === "file" ? "bg-purple-500/10 text-purple-700" :
                              "bg-pink-500/10 text-pink-700"
                            }`}>
                              {item.kind}
                            </span>
                            <h4 className="text-[12px] font-semibold text-slate-900 truncate">
                              {item.title}
                            </h4>
                          </div>
                          {item.body ? (
                            <p className="text-[11px] text-slate-600 line-clamp-2">{item.body}</p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {item.kind === "task" && item.taskStatus && item.taskId ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTaskFromActivity(item.taskId!);
                                }}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold transition-all hover:scale-105 ${taskStatusPillClasses(item.taskStatus)}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  item.taskStatus === "completed" ? "bg-emerald-500" :
                                  item.taskStatus === "in_progress" ? "bg-amber-500 animate-pulse" :
                                  "bg-red-400"
                                }`} />
                                {formatTaskStatusLabel(item.taskStatus)}
                              </button>
                            ) : null}
                            <span className="text-[10px] text-slate-500">{item.meta}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-medium text-slate-500">
                            {item.at ? new Date(item.at).toLocaleDateString() : "—"}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {item.at ? new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "notes" ? (
        <div className="space-y-4">
          <form onSubmit={handleNoteSubmit} className="space-y-2">
            <label className="block text-[11px] font-medium text-slate-700">
              Add note
            </label>
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Write an internal note about this project..."
            />
            {noteSaveError ? (
              <p className="text-[11px] text-red-600">{noteSaveError}</p>
            ) : null}
            <button
              type="submit"
              disabled={noteSaving}
              className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {noteSaving ? "Saving..." : "Save note"}
            </button>
          </form>

          <div className="border-t border-slate-200 pt-3">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Recent notes
            </h3>
            {notesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
                  <p className="text-[12px] font-medium text-slate-500">Loading notes…</p>
                </div>
              </div>
            ) : notesError ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6M9 9l6 6" />
                </svg>
                <p className="text-[11px] text-red-600">{notesError}</p>
              </div>
            ) : orderedNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30 py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-400">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </div>
                <p className="mt-2 text-[12px] font-medium text-slate-600">No notes yet</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Add a note above to get started</p>
              </div>
            ) : (
              <div className="relative space-y-0">
                {/* Timeline line */}
                <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-amber-300 via-orange-200 to-transparent" />
                
                {orderedNotes.map((note, index) => (
                  <div
                    key={note.id}
                    className={`group relative flex gap-3 pb-3 ${index === orderedNotes.length - 1 ? "pb-0" : ""}`}
                  >
                    {/* Timeline icon */}
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30 transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </div>

                    {/* Note card */}
                    <div className="flex-1 rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-orange-50/50 p-3 shadow-sm transition-all duration-200 hover:border-amber-300 hover:shadow-md">
                      <p className="text-[11px] leading-relaxed text-slate-700">{note.body}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-600">
                            {(note.author_name || "U")[0].toUpperCase()}
                          </div>
                          <span className="text-[10px] font-medium text-slate-600">
                            {(note.author_name || "Unknown").toString()}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(note.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "files" ? (
        <div className="space-y-4">
          <ProjectDocumentsTab
            projectId={projectId}
            onActivityEvent={() =>
              setActivityReloadKey((previous) => previous + 1)
            }
          />
        </div>
      ) : activeTab === "links" ? (
        <div className="space-y-4">
          {/* Add Link Form */}
          <div className="rounded-xl border border-pink-200/60 bg-gradient-to-r from-pink-50/50 to-rose-50/30 p-4">
            <h3 className="mb-3 text-[12px] font-semibold text-slate-800">Add a new link</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-medium text-slate-600 mb-1">URL</label>
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-900 shadow-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-medium text-slate-600 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  placeholder="Link title or description"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-900 shadow-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                />
              </div>
              <button
                type="button"
                disabled={!newLinkUrl.trim() || linkSaving}
                onClick={() => {
                  const url = newLinkUrl.trim();
                  if (!url) return;
                  const title = newLinkTitle.trim() || url;
                  setLinkSaving(true);
                  const newLink = {
                    id: `link-${Date.now()}`,
                    url,
                    title,
                    created_at: new Date().toISOString(),
                  };
                  setLinks((prev) => [newLink, ...prev]);
                  setNewLinkUrl("");
                  setNewLinkTitle("");
                  setLinkSaving(false);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 px-4 text-[11px] font-medium text-white shadow-sm transition-all hover:shadow-lg hover:shadow-pink-500/25 disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Link
              </button>
            </div>
          </div>

          {/* Links List */}
          <div className="border-t border-slate-200 pt-3">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Saved Links
            </h3>
            {links.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-pink-200 bg-gradient-to-br from-pink-50/50 to-rose-50/30 py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-rose-100 text-pink-400">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <p className="mt-2 text-[12px] font-medium text-slate-600">No links yet</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Add a link above to get started</p>
              </div>
            ) : (
              <div className="relative space-y-0">
                {/* Timeline line */}
                <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-pink-300 via-rose-200 to-transparent" />
                
                {links.map((link, index) => (
                  <div
                    key={link.id}
                    className={`group relative flex gap-3 pb-3 ${index === links.length - 1 ? "pb-0" : ""}`}
                  >
                    {/* Timeline icon */}
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-lg shadow-pink-500/30 transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </div>

                    {/* Link card */}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-xl border border-pink-200/60 bg-gradient-to-r from-pink-50/80 to-rose-50/50 p-3 shadow-sm transition-all duration-200 hover:border-pink-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[12px] font-semibold text-slate-900 truncate">{link.title}</h4>
                          <p className="mt-0.5 text-[10px] text-pink-600 truncate">{link.url}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{formatDate(link.created_at)}</span>
                          <svg className="h-4 w-4 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </div>
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Plan and track follow-up tasks for this project.
            </p>
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(true)}
              className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700"
            >
              New task
            </button>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Open tasks
                </h3>
                {/* View toggle */}
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setTaskViewMode("list")}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                      taskViewMode === "list"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskViewMode("kanban")}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                      taskViewMode === "kanban"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/>
                    </svg>
                    Board
                  </button>
                </div>
              </div>
              <div className="relative text-[10px] text-slate-600">
                <button
                  type="button"
                  onClick={() =>
                    setTaskUserFilterOpen((previous) => !previous)
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <span className="text-slate-500">Assignee:</span>
                  <span className="max-w-[140px] truncate text-slate-900">
                    {taskUserFilterLabel}
                  </span>
                  <span className="text-[8px] text-slate-500">▾</span>
                </button>
                {taskUserFilterOpen ? (
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 text-[10px] shadow-lg">
                    <input
                      type="text"
                      value={taskUserFilterSearch}
                      onChange={(event) =>
                        setTaskUserFilterSearch(event.target.value)
                      }
                      placeholder="Search users..."
                      className="mb-1 h-7 w-full rounded-full border border-slate-200 px-2 text-[10px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTaskUserFilterUserId(null);
                        setTaskUserFilterOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-slate-700 hover:bg-slate-50"
                    >
                      <span>All users</span>
                      {!taskUserFilterUserId ? (
                        <span className="text-[9px] text-slate-400">●</span>
                      ) : null}
                    </button>
                    <div className="mt-1 max-h-40 space-y-0.5 overflow-auto">
                      {filteredTaskFilterUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setTaskUserFilterUserId(user.id);
                            setTaskUserFilterOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-slate-700 hover:bg-slate-50"
                        >
                          <span className="truncate">
                            {user.full_name || user.email || "Unnamed user"}
                          </span>
                          {taskUserFilterUserId === user.id ? (
                            <span className="text-[9px] text-sky-500">●</span>
                          ) : null}
                        </button>
                      ))}
                      {filteredTaskFilterUsers.length === 0 ? (
                        <p className="px-2 py-1 text-[10px] text-slate-400">
                          No users match this search.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {tasksLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-500" />
                  <p className="text-[12px] font-medium text-slate-500">Loading tasks…</p>
                </div>
              </div>
            ) : tasksError ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6M9 9l6 6" />
                </svg>
                <p className="text-[11px] text-red-600">{tasksError}</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-400">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="mt-2 text-[12px] font-medium text-slate-600">No tasks yet</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Create a new task to get started</p>
              </div>
            ) : taskViewMode === "kanban" ? (
              /* Kanban Board View */
              <div className="grid grid-cols-3 gap-3">
                {(["not_started", "in_progress", "completed"] as const).map((status) => {
                  const columnTasks = tasksByStatus[status];
                  const columnConfig = {
                    not_started: { label: "Not Started", color: "red", bgGradient: "from-red-50 to-rose-50", borderColor: "border-red-200", headerBg: "bg-red-100", textColor: "text-red-700" },
                    in_progress: { label: "In Progress", color: "amber", bgGradient: "from-amber-50 to-orange-50", borderColor: "border-amber-200", headerBg: "bg-amber-100", textColor: "text-amber-700" },
                    completed: { label: "Completed", color: "emerald", bgGradient: "from-emerald-50 to-teal-50", borderColor: "border-emerald-200", headerBg: "bg-emerald-100", textColor: "text-emerald-700" },
                  }[status];
                  
                  return (
                    <div
                      key={status}
                      className={`flex flex-col rounded-xl border ${columnConfig.borderColor} bg-gradient-to-b ${columnConfig.bgGradient} min-h-[300px]`}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-sky-400"); }}
                      onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-sky-400"); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("ring-2", "ring-sky-400");
                        if (draggedTaskId) handleTaskDrop(draggedTaskId, status);
                      }}
                    >
                      {/* Column Header */}
                      <div className={`flex items-center justify-between rounded-t-xl ${columnConfig.headerBg} px-3 py-2`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${status === "not_started" ? "bg-red-500" : status === "in_progress" ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                          <span className={`text-[11px] font-semibold ${columnConfig.textColor}`}>{columnConfig.label}</span>
                        </div>
                        <span className={`rounded-full ${columnConfig.headerBg} px-2 py-0.5 text-[10px] font-bold ${columnConfig.textColor}`}>
                          {columnTasks.length}
                        </span>
                      </div>
                      
                      {/* Tasks */}
                      <div className="flex-1 space-y-2 p-2 overflow-y-auto">
                        {columnTasks.map((task) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => setDraggedTaskId(task.id)}
                            onDragEnd={() => setDraggedTaskId(null)}
                            className={`group cursor-grab rounded-lg border border-white/80 bg-white p-2.5 shadow-sm transition-all hover:shadow-md active:cursor-grabbing active:shadow-lg ${draggedTaskId === task.id ? "opacity-50 scale-95" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-[11px] font-semibold text-slate-900 line-clamp-2">{task.name}</h4>
                              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                                task.priority === "high" ? "bg-red-100 text-red-700" :
                                task.priority === "medium" ? "bg-amber-100 text-amber-700" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                            {task.content && (
                              <p className="mt-1 text-[10px] text-slate-500 line-clamp-2">{task.content}</p>
                            )}
                            <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
                              <span>{task.assigned_user_name || "Unassigned"}</span>
                              {task.activity_date && (
                                <span>{formatDate(task.activity_date)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {columnTasks.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <p className="text-[10px] text-slate-400">Drop tasks here</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              (() => {
                type GroupedTask = {
                  key: string;
                  name: string;
                  content: string | null;
                  activity_date: string | null;
                  priority: TaskPriority;
                  created_by_name: string | null;
                  created_at: string;
                  statuses: TaskStatus[];
                  assignedNames: string[];
                  taskIds: string[];
                  checklistItems: TaskChecklistItem[];
                };

                const groups: GroupedTask[] = [];
                const indexByKey = new Map<string, number>();

                function makeKey(task: Task): string {
                  return [
                    task.name,
                    task.content ?? "",
                    task.activity_date ?? "",
                    task.priority,
                    task.created_by_name ?? "",
                  ].join("||");
                }

                for (const task of tasks) {
                  const key = makeKey(task);
                  const existingIndex = indexByKey.get(key);

                  if (existingIndex === undefined) {
                    groups.push({
                      key,
                      name: task.name,
                      content: task.content,
                      activity_date: task.activity_date,
                      priority: task.priority,
                      created_by_name: task.created_by_name,
                      created_at: task.created_at,
                      statuses: [task.status],
                      assignedNames: task.assigned_user_name
                        ? [task.assigned_user_name]
                        : [],
                      taskIds: [task.id],
                      checklistItems: checklistByTaskId[task.id] ?? [],
                    });
                    indexByKey.set(key, groups.length - 1);
                  } else {
                    const group = groups[existingIndex];
                    group.statuses.push(task.status);
                    if (
                      task.assigned_user_name &&
                      !group.assignedNames.includes(task.assigned_user_name)
                    ) {
                      group.assignedNames.push(task.assigned_user_name);
                    }
                    if (!group.taskIds.includes(task.id)) {
                      group.taskIds.push(task.id);
                    }
                  }
                }

                const filteredGroups = groups.filter((group) => {
                  if (
                    !isWithinDateRange(
                      group.created_at ?? null,
                      filterFromDate,
                      filterToDate,
                    )
                  ) {
                    return false;
                  }

                  if (taskUserFilterUserId) {
                    const hasUser = tasks.some(
                      (task) =>
                        group.taskIds.includes(task.id) &&
                        task.assigned_user_id === taskUserFilterUserId,
                    );
                    if (!hasUser) return false;
                  }

                  if (!normalizedFilter) return true;

                  return matchesAnyText(
                    [
                      group.name,
                      group.content,
                      group.created_by_name,
                      group.assignedNames.join(", "),
                    ],
                    normalizedFilter,
                  );
                });

                filteredGroups.sort((a, b) => {
                  const aDate = (a.created_at ?? "").slice(0, 10);
                  const bDate = (b.created_at ?? "").slice(0, 10);
                  if (filterSortOrder === "desc") {
                    return bDate.localeCompare(aDate);
                  }
                  return aDate.localeCompare(bDate);
                });

                const visibleGroups = filteredGroups;

                return (
                  <div className="relative space-y-0">
                    {/* Timeline line */}
                    <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-emerald-300 via-teal-200 to-transparent" />
                    
                    {visibleGroups.map((group, index) => {
                      const allCompleted = group.statuses.every(
                        (status) => status === "completed",
                      );
                      const anyInProgress = group.statuses.some(
                        (status) => status === "in_progress",
                      );

                      const displayStatus: TaskStatus = allCompleted
                        ? "completed"
                        : anyInProgress
                        ? "in_progress"
                        : "not_started";

                      const assignedLabel =
                        group.assignedNames.length === 0
                          ? "Unassigned"
                          : group.assignedNames.join(", ");

                      const priorityColor = group.priority === "high" 
                        ? "from-red-400 to-rose-500 shadow-red-500/30"
                        : group.priority === "medium"
                        ? "from-amber-400 to-orange-500 shadow-amber-500/30"
                        : "from-slate-400 to-slate-500 shadow-slate-500/30";

                      const statusIcon = displayStatus === "completed"
                        ? "from-emerald-400 to-teal-500 shadow-emerald-500/30"
                        : displayStatus === "in_progress"
                        ? "from-amber-400 to-orange-500 shadow-amber-500/30"
                        : "from-red-400 to-rose-500 shadow-red-500/30";

                      return (
                        <div
                          key={group.key}
                          className={`group relative flex gap-3 pb-3 ${index === visibleGroups.length - 1 ? "pb-0" : ""}`}
                        >
                          {/* Timeline icon */}
                          <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${statusIcon} text-white shadow-lg transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl`}>
                            {displayStatus === "completed" ? (
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : displayStatus === "in_progress" ? (
                              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                              </svg>
                            )}
                          </div>

                          {/* Task card */}
                          <div
                            className={`flex-1 cursor-pointer rounded-xl border p-3 shadow-sm transition-all duration-200 hover:shadow-md ${
                              displayStatus === "completed"
                                ? "border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 hover:border-emerald-300"
                                : displayStatus === "in_progress"
                                ? "border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-orange-50/50 hover:border-amber-300"
                                : "border-red-200/60 bg-gradient-to-r from-red-50/80 to-rose-50/50 hover:border-red-300"
                            }`}
                            onClick={() => {
                              setIsEditingTask(false);
                              setSelectedTaskGroup({
                                ...group,
                                primaryTaskId: group.taskIds[0] ?? null,
                              });
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-[12px] font-semibold text-slate-900">{group.name}</h4>
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                    group.priority === "high" ? "bg-red-100 text-red-700" :
                                    group.priority === "medium" ? "bg-amber-100 text-amber-700" :
                                    "bg-slate-100 text-slate-600"
                                  }`}>
                                    {group.priority}
                                  </span>
                                </div>
                                {group.content ? (
                                  <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">{group.content}</p>
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="3" y="4" width="18" height="18" rx="2" />
                                      <path d="M16 2v4M8 2v4M3 10h18" />
                                    </svg>
                                    Due {formatDate(group.activity_date ?? group.created_at)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                      <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    {assignedLabel}
                                  </span>
                                </div>
                                {group.checklistItems.length > 0 ? (
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="flex h-5 items-center gap-1 rounded-full bg-white/80 px-2 text-[10px] font-medium text-slate-600">
                                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                      </svg>
                                      {group.checklistItems.filter(i => i.is_completed).length}/{group.checklistItems.length} done
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                              <div className="relative shrink-0">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setStatusDropdownOpenKey((previous) =>
                                      previous === group.key ? null : group.key,
                                    );
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all hover:scale-105 ${taskStatusPillClasses(displayStatus)}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${
                                    displayStatus === "completed" ? "bg-emerald-500" :
                                    displayStatus === "in_progress" ? "bg-amber-500 animate-pulse" :
                                    "bg-red-400"
                                  }`} />
                                  {formatTaskStatusLabel(displayStatus)}
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                                {statusDropdownOpenKey === group.key ? (
                                  <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-[10px] shadow-xl">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setStatusDropdownOpenKey(null);
                                        void handleChangeTaskStatus(group.taskIds, "not_started");
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-red-50"
                                    >
                                      <span className="h-2 w-2 rounded-full bg-red-400" />
                                      Not started
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setStatusDropdownOpenKey(null);
                                        void handleChangeTaskStatus(group.taskIds, "in_progress");
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-amber-50"
                                    >
                                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                                      In progress
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setStatusDropdownOpenKey(null);
                                        void handleChangeTaskStatus(group.taskIds, "completed");
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-emerald-50"
                                    >
                                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                      Completed
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {isTaskModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => {
              if (!taskSaving) {
                setIsTaskModalOpen(false);
                setTaskSaveError(null);
              }
            }}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200/80 bg-white/95 p-4 text-xs shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">New task</h3>
                <p className="text-[11px] text-slate-500">
                  Create a follow-up task for this project and assign it to one or
                  more team members.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!taskSaving) {
                    setIsTaskModalOpen(false);
                    setTaskSaveError(null);
                  }
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] text-slate-500 hover:bg-slate-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleTaskSubmit} className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="project_task_name"
                    className="block text-[11px] font-medium text-slate-700"
                  >
                    Task name
                  </label>
                  <input
                    id="project_task_name"
                    type="text"
                    value={taskName}
                    onChange={(event) => setTaskName(event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Follow up with client, prepare quote..."
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="project_task_activity_date"
                    className="block text-[11px] font-medium text-slate-700"
                  >
                    Due date (optional)
                  </label>
                  <input
                    id="project_task_activity_date"
                    type="date"
                    value={taskActivityDate}
                    onChange={(event) => setTaskActivityDate(event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-700">
                  Assignees
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedAssigneeIds.length === 0 ? (
                    <span className="text-[11px] text-slate-400">
                      No assignees yet. Defaults to you.
                    </span>
                  ) : (
                    selectedAssigneeIds.map((id) => {
                      const user = users.find((u) => u.id === id);
                      const label = (
                        user?.full_name || user?.email || "Unnamed"
                      ).toString();
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setSelectedAssigneeIds((prev) =>
                              prev.filter((value) => value !== id),
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-200"
                        >
                          <span>{label}</span>
                          <span className="text-[11px] text-slate-500">×</span>
                        </button>
                      );
                    })
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssigneePicker((prev) => !prev);
                      setAssigneeSearch("");
                    }}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-[13px] text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    +
                  </button>
                </div>

                {showAssigneePicker ? (
                  <div className="mt-2 space-y-1">
                    <input
                      type="text"
                      value={assigneeSearch}
                      onChange={(event) => setAssigneeSearch(event.target.value)}
                      placeholder="Search team members..."
                      className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white/95">
                      {usersLoading ? (
                        <div className="px-3 py-2 text-[11px] text-slate-500">
                          Loading team members...
                        </div>
                      ) : usersError ? (
                        <div className="px-3 py-2 text-[11px] text-red-600">
                          {usersError}
                        </div>
                      ) : users.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-slate-500">
                          No team members found.
                        </div>
                      ) : (
                        (() => {
                          const query = assigneeSearch.toLowerCase().trim();
                          const available = users.filter((user) => {
                            if (selectedAssigneeIds.includes(user.id)) return false;
                            if (!query) return true;
                            const text = (
                              user.full_name || user.email || ""
                            )
                              .toString()
                              .toLowerCase();
                            return text.includes(query);
                          });

                          if (available.length === 0) {
                            return (
                              <div className="px-3 py-2 text-[11px] text-slate-500">
                                No matching team members.
                              </div>
                            );
                          }

                          return available.map((user) => {
                            const label = (
                              user.full_name || user.email || "Unnamed"
                            ).toString();
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => {
                                  setSelectedAssigneeIds((prev) =>
                                    prev.includes(user.id)
                                      ? prev
                                      : [...prev, user.id],
                                  );
                                  setAssigneeSearch("");
                                }}
                                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-50"
                              >
                                <span>{label}</span>
                              </button>
                            );
                          });
                        })()
                      )}
                    </div>
                  </div>
                ) : null}

                <p className="text-[10px] text-slate-500">
                  Leave empty to assign the task to yourself by default.
                </p>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="project_task_content"
                  className="block text-[11px] font-medium text-slate-700"
                >
                  Details (optional)
                </label>
                <textarea
                  id="project_task_content"
                  value={taskContent}
                  onChange={(event) => setTaskContent(event.target.value)}
                  rows={2}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Checklist (optional)
                  </label>
                  <label className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      checked={checklistEnabled}
                      onChange={(event) => setChecklistEnabled(event.target.checked)}
                    />
                    <span>Add checklist</span>
                  </label>
                </div>
                {checklistEnabled ? (
                  <textarea
                    value={checklistText}
                    onChange={(event) => setChecklistText(event.target.value)}
                    rows={3}
                    className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Add one checklist item per line..."
                  />
                ) : null}
                <p className="text-[10px] text-slate-500">
                  Use this for multi-step tasks where you want to tick off individual
                  items.
                </p>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="project_task_priority"
                  className="block text-[11px] font-medium text-slate-700"
                >
                  Priority
                </label>
                <select
                  id="project_task_priority"
                  value={taskPriority}
                  onChange={(event) =>
                    setTaskPriority(event.target.value as TaskPriority)
                  }
                  className="block w-full max-w-[160px] rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {taskSaveError ? (
                <p className="text-[11px] text-red-600">{taskSaveError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!taskSaving) {
                      setIsTaskModalOpen(false);
                      setTaskSaveError(null);
                    }
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskSaving}
                  className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {taskSaving ? "Saving..." : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedTaskGroup ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSelectedTaskGroup(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200/80 bg-white/95 p-4 text-xs shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {selectedTaskGroup.name}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Task details and checklist.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskGroup(null)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] text-slate-500 hover:bg-slate-50"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {selectedTaskGroup.content ? (
                <p className="text-[11px] text-slate-700">
                  {selectedTaskGroup.content}
                </p>
              ) : null}
              <p className="text-[10px] text-slate-500">
                Due {formatDate(selectedTaskGroup.activity_date ?? selectedTaskGroup.created_at)} • Priority {selectedTaskGroup.priority}
              </p>
              <p className="text-[10px] text-slate-400">
                Created {formatDate(selectedTaskGroup.created_at)}
              </p>
              <p className="text-[10px] text-slate-400">
                Created by {selectedTaskGroup.created_by_name || "Unknown"}
              </p>
              <p className="text-[10px] text-slate-400">
                Assigned to {selectedTaskGroup.assignedNames.join(", ") || "Unassigned"}
              </p>
              {selectedTaskDisplayStatus ? (
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>Status</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setModalStatusDropdownOpen((previous) => !previous)
                      }
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium " +
                        taskStatusPillClasses(selectedTaskDisplayStatus)
                      }
                    >
                      <span>
                        {formatTaskStatusLabel(selectedTaskDisplayStatus)}
                      </span>
                      <span className="text-[9px]">▾</span>
                    </button>
                    {modalStatusDropdownOpen ? (
                      <div className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-slate-200 bg-white py-1 text-[10px] shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setModalStatusDropdownOpen(false);
                            void handleChangeTaskStatus(
                              selectedTaskGroup.taskIds,
                              "not_started",
                            );
                          }}
                          className="flex w-full items-center justify-between px-2 py-1 text-left text-slate-700 hover:bg-red-50"
                        >
                          <span>Not started</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalStatusDropdownOpen(false);
                            void handleChangeTaskStatus(
                              selectedTaskGroup.taskIds,
                              "in_progress",
                            );
                          }}
                          className="flex w-full items-center justify-between px-2 py-1 text-left text-slate-700 hover:bg-amber-50"
                        >
                          <span>In progress</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalStatusDropdownOpen(false);
                            void handleChangeTaskStatus(
                              selectedTaskGroup.taskIds,
                              "completed",
                            );
                          }}
                          className="flex w-full items-center justify-between px-2 py-1 text-left text-slate-700 hover:bg-emerald-50"
                        >
                          <span>Completed</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {selectedTaskGroup.checklistItems.length > 0 ? (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-medium text-slate-700">
                    Checklist
                  </p>
                  {selectedTaskGroup.checklistItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleToggleChecklistItem(item)}
                      className="flex w-full items-center gap-2 text-left text-[10px] text-slate-600 hover:text-slate-900"
                    >
                      <span
                        className={
                          "inline-flex h-3.5 w-3.5 items-center justify-center rounded border " +
                          (item.is_completed
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-white text-transparent")
                        }
                      >
                        ✓
                      </span>
                      <span
                        className={
                          item.is_completed ? "line-through opacity-60" : ""
                        }
                      >
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-slate-500">
                  No checklist items for this task.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={filePreviewOpen}
        onClose={() => setFilePreviewOpen(false)}
        fileUrl={filePreviewUrl}
        fileName={filePreviewName}
      />
    </div>
  );
}
