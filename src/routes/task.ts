import { Hono } from "hono";
import { authMiddleware } from "@middlewares/auth";
import { storeTask } from "@controllers/task/store";
import { listTasks } from "@controllers/task/list";
import { showTask } from "@controllers/task/show";
import { updateTask } from "@controllers/task/update";
import { deleteTask } from "@controllers/task/delete";

const task = new Hono();

task.get("/tasks", authMiddleware, listTasks);
task.post("/task", authMiddleware, storeTask);
task.get("/task/:id", authMiddleware, showTask);
task.put("/task/:id", authMiddleware, updateTask);
task.delete("/task/:id", authMiddleware, deleteTask);

export {
	task as taskRoute
}
