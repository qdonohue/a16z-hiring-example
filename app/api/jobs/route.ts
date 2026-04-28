import { getAvailableJobs, loadJobContext } from "@/lib/ai/interview";

export async function GET() {
  const jobIds = getAvailableJobs();
  const jobs = jobIds.map((id) => {
    const context = loadJobContext(id);
    // Extract the title from the first line of context.md
    const titleMatch = context?.context.match(/^#\s+(.+)/m);
    const title = titleMatch?.[1] || id;
    return { id, title };
  });

  return Response.json({ jobs });
}
