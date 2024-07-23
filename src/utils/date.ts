export function dateToTimestamp (date: string): number {
	const dateSplitted = date.split(" ");
	const dateStr = dateSplitted[0];
	const timeStr = dateSplitted[1] ?? "00:00:00";

	const [year, month, day] = dateStr.split("-");
	const [hour, minute, second] = timeStr.split(":");

	const timestamp = new Date(
		parseInt(year),
		parseInt(month) - 1,
		parseInt(day),
		parseInt(hour),
		parseInt(minute),
		parseInt(second)
	).getTime();

	return timestamp;
}
