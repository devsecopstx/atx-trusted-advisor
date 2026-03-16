"use client";

import { FormEvent, useCallback, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type ScheduledTask = {
  _id?: string;
  name: string;
  category: "sync-broker" | "rebalance" | "compliance" | "notifications";
  scheduleCron: string;
  enabled: boolean;
  nextRunAt?: string;
};

export function TasksConsole() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [status, setStatus] = useState("Ready - tap refresh");

  const refreshTasks = useCallback(async () => {
    setStatus("Loading tasks...");
    try {
      const payload = await parseJson<{ data: ScheduledTask[] }>(await fetch("/api/admin/tasks"));
      setTasks(payload.data);
      setStatus("Synced");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to refresh tasks");
    }
  }, []);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("Creating task...");
    try {
      await parseJson(
        await fetch("/api/admin/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(formData.get("name") ?? ""),
            category: String(formData.get("category") ?? ""),
            scheduleCron: String(formData.get("scheduleCron") ?? ""),
            enabled: true
          })
        })
      );
      event.currentTarget.reset();
      await refreshTasks();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create task");
    }
  }

  async function runTask(taskId: string | undefined) {
    if (!taskId) {
      return;
    }
    setStatus(`Running task ${taskId}...`);
    try {
      await parseJson(
        await fetch(`/api/admin/tasks/${taskId}/run`, {
          method: "POST"
        })
      );
      await refreshTasks();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to run task");
    }
  }

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button className="cta cta-secondary" onClick={() => void refreshTasks()} type="button">
          Refresh tasks
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Create Task</h3>
        <form className="stack-form" onSubmit={createTask}>
          <input name="name" placeholder="task name" required />
          <select name="category" defaultValue="sync-broker">
            <option value="sync-broker">sync-broker</option>
            <option value="rebalance">rebalance</option>
            <option value="compliance">compliance</option>
            <option value="notifications">notifications</option>
          </select>
          <input name="scheduleCron" placeholder="0 2 * * *" required />
          <button className="cta cta-primary" type="submit">
            Create task
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Latest Tasks</h3>
        <ul className="data-list">
          {tasks.map((task) => (
            <li key={task._id ?? task.name}>
              <span>{task.name}</span>
              <button className="tiny-button" onClick={() => void runTask(task._id)} type="button">
                Run
              </button>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
