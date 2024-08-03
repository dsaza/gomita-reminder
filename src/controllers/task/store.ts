import { Context } from "hono";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { ApiResponse, AuthVariables, WorkerBindings } from "@/types";
import { parseBody } from "@lib/request";
import { dateToTimestamp } from "@utils/date";
import { TASK_STATUS } from "@/constants";

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
