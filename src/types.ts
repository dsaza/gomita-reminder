export type WorkerBindings = {
	DB: D1Database;
	ROOT_KEY: string;
	RESEND_KEY: string;
	RESEND_EMAIL: string;
	JWT_SECRET: string;
	JWT_REFRESH_SECRET: string;
	JWT_ACCOUNT_SECRET: string;
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

export interface IUser {
	id: string;
	name: string;
	lastname: string;
	nickname: string;
	pin: string;
	birthdate: number;
	phone: string;
	email: string;
	avatar: string | null;
	telegramChatId: string;
	otpCode: string | null;
	otpExpiration: number | null;
}
