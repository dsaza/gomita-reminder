import { Hono } from "hono";
import { deleteTask, listTasks, showTask, storeTask, updateTask } from "../controllers/task.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const task = new Hono();

task.get("/tasks", authMiddleware, listTasks);
task.post("/task", authMiddleware, storeTask);
task.get("/task/:id", authMiddleware, showTask);
task.put("/task/:id", authMiddleware, updateTask);
task.delete("/task/:id", authMiddleware, deleteTask);

export {
	task as taskRoute
}
