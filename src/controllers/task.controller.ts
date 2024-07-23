import { Context } from "hono";
import { date, z } from "zod";
import { v4 as uuid } from "uuid";
import { ApiResponse, WorkerBindings, AuthVariables } from "../types";
import { parseBody } from "../utils/request";
import { dateToTimestamp } from "../utils/date";
import { TASK_STATUS } from "../constants";

export async function storeTask (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");

		const body = await parseBody(c);

		if (body === null) {
			return c.json<ApiResponse>({
				status: "INVALID_BODY",
				message: "No body provided"
			}, 400);
		}

		const taskSchema = z.object({
			title: z.string().trim().min(1).max(100),
			content: z.string().trim().min(1).max(1000),
			date: z.string().trim().length(19).regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
		});

		const task = taskSchema.parse(body);
		const now = Date.now();

		const taskId = uuid();

		await c.env.DB
			.prepare("INSERT INTO Tasks (id, title, content, date, status, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
			.bind(taskId, task.title, task.content, dateToTimestamp(task.date), TASK_STATUS.PENDING, user.id, now, now)
			.run();

		return c.json<ApiResponse>({
			status: "OK",
			message: "Task created successfully",
			data: {
				id: taskId
			}
		});
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstError = error.errors[0];
			return c.json<ApiResponse>({
				status: "VALIDATION_ERROR",
				message: `[${firstError.path}]: ${firstError.message}`,
			}, 400);
		}

		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}

export async function listTasks (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");

		const pageStr = c.req.query("page") ?? "1";
		const page = +pageStr > 0 ? +pageStr : 1;

		const limitStr = c.req.query("limit") ?? "25";
		const limit = +limitStr > 0 ? +limitStr : 25;

		const statusStr = c.req.query("status") ?? "";
		const status = Object.keys(TASK_STATUS).includes(statusStr) ? statusStr : "";

		const prepareQueryList = status !== ""
			? c.env.DB
				.prepare("SELECT * FROM Tasks WHERE userId = ? AND status = ? ORDER BY date ASC LIMIT ? OFFSET ?")
				.bind(user.id, status, limit, (page - 1) * limit)
			: c.env.DB
				.prepare("SELECT * FROM Tasks WHERE userId = ? ORDER BY date ASC LIMIT ? OFFSET ?")
				.bind(user.id, limit, (page - 1) * limit);

		const queryList = await prepareQueryList.all();

		const prepareQueryTotal = status !== ""
			? c.env.DB
				.prepare("SELECT COUNT(*) as total FROM Tasks WHERE userId = ? AND status = ?")
				.bind(user.id, status)
			: c.env.DB
				.prepare("SELECT COUNT(*) as total FROM Tasks WHERE userId = ?")
				.bind(user.id);

		const queryTotal = await prepareQueryTotal.first<{ total: number }>();

		const total = queryTotal?.total ?? 0;
		const tasks = queryList.results ?? [];

		return c.json<ApiResponse>({
			status: "OK",
			message: "Tasks fetched successfully",
			data: {
				tasks: tasks.map(task => ({
					id: task.id,
					title: task.title,
					status: task.status,
					date: task.date,
					updatedAt: task.updatedAt
				})),
				pagination: {
					page,
					limit,
					totalPages: total < 1 ? 0 : Math.ceil(total / limit),
					total
				}
			}
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}

export async function showTask (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");
		const taskId = c.req.param("id");

		const task = await c.env.DB
			.prepare("SELECT * FROM Tasks WHERE id = ? AND userId = ?")
			.bind(taskId, user.id)
			.first();

		if (task === null) {
			return c.json<ApiResponse>({
				status: "NOT_FOUND",
				message: "Task not found"
			}, 404);
		}

		return c.json<ApiResponse>({
			status: "OK",
			message: "Task fetched successfully",
			data: task
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}

export async function updateTask (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");
		const taskId = c.req.param("id");

		const body = await parseBody(c);

		if (body === null) {
			return c.json<ApiResponse>({
				status: "INVALID_BODY",
				message: "No body provided"
			}, 400);
		}

		const taskSchema = z.object({
			title: z.string().trim().min(1).max(100),
			content: z.string().trim().min(1).max(1000),
			date: z.string().trim().length(19).regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
		});

		const task = taskSchema.parse(body);
		const now = Date.now();

		const query = await c.env.DB
			.prepare("UPDATE Tasks SET title = ?, content = ?, date = ?, updatedAt = ? WHERE id = ? AND userId = ?")
			.bind(task.title, task.content, dateToTimestamp(task.date), now, taskId, user.id).run();

		if (query.meta.changes === 0) {
			return c.json<ApiResponse>({
				status: "NOT_FOUND",
				message: "Task not found"
			}, 404);
		}

		return c.json<ApiResponse>({
			status: "OK",
			message: "Task updated successfully"
		});
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			const firstError = error.errors[0];
			return c.json<ApiResponse>({
				status: "VALIDATION_ERROR",
				message: `[${firstError.path}]: ${firstError.message}`,
			}, 400);
		}

		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}

export async function deleteTask (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");
		const taskId = c.req.param("id");

		const query = await c.env.DB
			.prepare("DELETE FROM Tasks WHERE id = ? AND userId = ?")
			.bind(taskId, user.id)
			.run();

		if (query.meta.changes === 0) {
			return c.json<ApiResponse>({
				status: "NOT_FOUND",
				message: "Task not found"
			}, 404);
		}

		return c.json<ApiResponse>({
			status: "OK",
			message: "Task deleted successfully"
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}
