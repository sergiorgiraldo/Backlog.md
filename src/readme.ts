import { join } from "node:path";
import { exportKanbanBoardToFile } from "./board.ts";
import type { Task } from "./types/index.ts";

const BOARD_START = "<!-- BOARD_START -->";
const BOARD_END = "<!-- BOARD_END -->";

export async function updateReadmeWithBoard(tasks: Task[], statuses: string[], projectName: string) {
	const readmePath = join(process.cwd(), "README.md");
	let readmeContent = "";
	try {
		readmeContent = await Bun.file(readmePath).text();
	} catch {
		// If README.md doesn't exist, create it.
	}

	// Use the same high-quality board generation as file export
	// Create a temporary file to get the properly formatted board
	const tempPath = join(process.cwd(), ".temp-board.md");
	await exportKanbanBoardToFile(tasks, statuses, tempPath, projectName);
	const fullBoardContent = await Bun.file(tempPath).text();

	// Extract timestamp from the board content
	const timestampMatch = fullBoardContent.match(/Generated on: ([^\n]+)/);
	const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString().replace("T", " ").substring(0, 19);

	// Extract just the board table (skip all metadata headers)
	const lines = fullBoardContent.split("\n");
	const tableStartIndex = lines.findIndex(
		(line) =>
			line.includes("|") &&
			(line.includes("To Do") || line.includes("In Progress") || line.includes("Done") || line.includes("---")),
	);
	const boardTable = lines.slice(tableStartIndex).join("\n").trim();

	// Clean up temp file
	try {
		await Bun.file(tempPath).write("");
		await Bun.$`rm -f ${tempPath}`;
	} catch {
		// Ignore cleanup errors
	}

	// Create the board section with a nice title
	const statusTitle = `## 📊 ${projectName} Project Status (automatically generated by Backlog.md)`;
	const boardSection = `${statusTitle}\n\nGenerated on: ${timestamp}\n\n${boardTable}`;

	const startMarkerIndex = readmeContent.indexOf(BOARD_START);
	const endMarkerIndex = readmeContent.indexOf(BOARD_END);
	const licenseIndex = readmeContent.indexOf("## License");

	if (startMarkerIndex !== -1 && endMarkerIndex !== -1) {
		const preContent = readmeContent.substring(0, startMarkerIndex + BOARD_START.length);
		const postContent = readmeContent.substring(endMarkerIndex);
		readmeContent = `${preContent}\n\n${boardSection}\n\n${postContent}`;
	} else if (licenseIndex !== -1) {
		const preContent = readmeContent.substring(0, licenseIndex);
		const postContent = readmeContent.substring(licenseIndex);
		readmeContent = `${preContent}${BOARD_START}\n\n${boardSection}\n\n${BOARD_END}\n\n${postContent}`;
	} else {
		// If markers are not found, append the board at the end of the file.
		readmeContent += `\n\n${BOARD_START}\n\n${boardSection}\n\n${BOARD_END}`;
	}

	await Bun.write(readmePath, readmeContent);
}
