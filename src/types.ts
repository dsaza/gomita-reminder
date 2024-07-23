export type WorkerBindings = {
	DB: D1Database;
	ROOT_KEY: string;
	RESEND_KEY: string;
	JWT_SECRET: string;
	JWT_REFRESH_SECRET: string;
}

export type AuthVariables = {
	user: {
		id: string;
		email: string;
	}
}

export interface ApiResponse {
	status: string;
	message: string;
	data?: any;
}
