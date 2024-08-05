import { Context } from "hono";
import { TASK_STATUS } from "@/constants";
import { ApiResponse, AuthVariables, WorkerBindings } from "@/types";

export async function listTasks (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");

		const pageParam = c.req.query("page") ?? "1";
		const page = +pageParam > 0 ? +pageParam : 1;

		const limitParam = c.req.query("limit") ?? "25";
		const limit = +limitParam > 0 ? +limitParam : 25;

		const statusParam = c.req.query("status") ?? "";
		const status = Object.keys(TASK_STATUS).includes(statusParam) ? statusParam : "";

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
			message: "Lista de tareas",
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
			message: "Ha ocurrido un error interno"
		}, 500);
	}
}
