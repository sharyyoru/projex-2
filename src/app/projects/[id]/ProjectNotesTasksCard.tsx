"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useProjectActivityFeed } from "./ProjectActivityFeed";
import ProjectDocumentsTab from "./ProjectDocumentsTab";

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
    useState<"activity" | "notes" | "tasks" | "files">("activity");

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
              : "Store and access files for this project."}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/80 p-0.5 text-[11px] text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={
              "rounded-full px-3 py-0.5 " +
              (activeTab === "activity"
                ? "bg-slate-900 text-white shadow-sm"
                : "hover:text-slate-900")
            }
          >
            Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={
              "rounded-full px-3 py-0.5 " +
              (activeTab === "notes"
                ? "bg-slate-900 text-white shadow-sm"
                : "hover:text-slate-900")
            }
          >
            Notes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={
              "rounded-full px-3 py-0.5 " +
              (activeTab === "tasks"
                ? "bg-slate-900 text-white shadow-sm"
                : "hover:text-slate-900")
            }
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("files")}
            className={
              "rounded-full px-3 py-0.5 " +
              (activeTab === "files"
                ? "bg-slate-900 text-white shadow-sm"
                : "hover:text-slate-900")
            }
          >
            Files
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Search</span>
          <input
            type="text"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Search notes, tasks, and files..."
            className="h-7 w-44 rounded-full border border-slate-200 bg-white px-2 text-[11px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">From</span>
          <input
            type="date"
            value={filterFromDate}
            onChange={(event) => setFilterFromDate(event.target.value)}
            className="h-7 rounded-full border border-slate-200 bg-white px-2 text-[11px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <span className="text-slate-500">To</span>
          <input
            type="date"
            value={filterToDate}
            onChange={(event) => setFilterToDate(event.target.value)}
            className="h-7 rounded-full border border-slate-200 bg-white px-2 text-[11px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Order</span>
          <button
            type="button"
            onClick={() =>
              setFilterSortOrder((previous) =>
                previous === "desc" ? "asc" : "desc",
              )
            }
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {filterSortOrder === "desc" ? "Newest first" : "Oldest first"}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
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
            <p className="text-[11px] text-slate-500">Loading activity…</p>
          ) : activityError ? (
            <p className="text-[11px] text-red-600">{activityError}</p>
          ) : !activityHasItemsWithoutDeals ? (
            <p className="text-[11px] text-slate-500">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {orderedActivityItems.map((item) => (
                <div
                  key={item.id}
                  className={
                    "flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 " +
                    (item.kind === "task"
                      ? "cursor-pointer hover:border-slate-200 hover:bg-slate-50"
                      : "")
                  }
                  onClick={() => {
                    if (item.kind === "task" && item.taskId) {
                      openTaskFromActivity(item.taskId);
                    }
                  }}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          (item.kind === "note" || item.kind === "file"
                            ? "bg-slate-900 text-slate-50"
                            : item.kind === "task"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.kind === "invoice"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-amber-50 text-amber-700")
                        }
                      >
                        {item.kind === "note"
                          ? "Note"
                          : item.kind === "task"
                          ? "Task"
                          : item.kind === "invoice"
                          ? "Invoice"
                          : item.kind === "file"
                          ? "File"
                          : "Deal"}
                      </span>
                      <p className="text-[11px] font-medium text-slate-900">
                        {item.title}
                      </p>
                    </div>
                    {item.body ? (
                      <p className="text-[11px] text-slate-700">{item.body}</p>
                    ) : null}
                    <p className="flex items-center gap-1 text-[10px] text-slate-500">
                      {item.kind === "task" && item.taskStatus && item.taskId ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openTaskFromActivity(item.taskId!);
                          }}
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium " +
                            taskStatusPillClasses(item.taskStatus)
                          }
                        >
                          {formatTaskStatusLabel(item.taskStatus)}
                        </button>
                      ) : null}
                      <span>{item.meta}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-[10px] text-slate-400">
                    {item.at ? new Date(item.at).toLocaleString() : "—"}
                  </p>
                </div>
              ))}
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
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Recent notes
            </h3>
            {notesLoading ? (
              <p className="text-[11px] text-slate-500">Loading notes...</p>
            ) : notesError ? (
              <p className="text-[11px] text-red-600">{notesError}</p>
            ) : orderedNotes.length === 0 ? (
              <p className="text-[11px] text-slate-500">No notes yet.</p>
            ) : (
              <div className="space-y-2">
                {orderedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                  >
                    <p className="text-[11px] text-slate-800">{note.body}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {(note.author_name || "Unknown").toString()} • {" "}
                      {formatDate(note.created_at)}
                    </p>
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
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Open tasks
              </h3>
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
              <p className="text-[11px] text-slate-500">Loading tasks...</p>
            ) : tasksError ? (
              <p className="text-[11px] text-red-600">{tasksError}</p>
            ) : tasks.length === 0 ? (
              <p className="text-[11px] text-slate-500">No tasks yet.</p>
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
                  <div className="space-y-2">
                    {visibleGroups.map((group) => {
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

                      return (
                        <div
                          key={group.key}
                          className="flex cursor-pointer items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 hover:border-slate-200 hover:bg-slate-50"
                          onClick={() => {
                            setIsEditingTask(false);
                            setSelectedTaskGroup({
                              ...group,
                              primaryTaskId: group.taskIds[0] ?? null,
                            });
                          }}
                        >
                          <div>
                            <p className="text-[11px] font-medium text-slate-900">
                              {group.name}
                            </p>
                            {group.content ? (
                              <p className="mt-0.5 text-[10px] text-slate-600">
                                {group.content}
                              </p>
                            ) : null}
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              Due {formatDate(group.activity_date ?? group.created_at)} •{" "}
                              Priority {group.priority}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              Created {formatDate(group.created_at)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              Created by {group.created_by_name || "Unknown"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              Assigned to {assignedLabel}
                            </p>
                            {group.checklistItems.length > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                {group.checklistItems.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleToggleChecklistItem(item);
                                    }}
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
                                        item.is_completed
                                          ? "line-through opacity-60"
                                          : ""
                                      }
                                    >
                                      {item.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setStatusDropdownOpenKey((previous) =>
                                    previous === group.key ? null : group.key,
                                  );
                                }}
                                className={
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " +
                                  taskStatusPillClasses(displayStatus)
                                }
                              >
                                <span>{formatTaskStatusLabel(displayStatus)}</span>
                                <span className="text-[9px]">▾</span>
                              </button>
                              {statusDropdownOpenKey === group.key ? (
                                <div className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-slate-200 bg-white py-1 text-[10px] shadow-lg">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setStatusDropdownOpenKey(null);
                                      void handleChangeTaskStatus(
                                        group.taskIds,
                                        "not_started",
                                      );
                                    }}
                                    className="flex w-full items-center justify-between px-2 py-1 text-left text-slate-700 hover:bg-red-50"
                                  >
                                    <span>Not started</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setStatusDropdownOpenKey(null);
                                      void handleChangeTaskStatus(
                                        group.taskIds,
                                        "in_progress",
                                      );
                                    }}
                                    className="flex w-full items-center justify-between px-2 py-1 text-left text-slate-700 hover:bg-amber-50"
                                  >
                                    <span>In progress</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setStatusDropdownOpenKey(null);
                                      void handleChangeTaskStatus(
                                        group.taskIds,
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
    </div>
  );
}
