import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Preview } from "./Preview";

// Design preview with fake data. Dev only: a real 404 in production.
export default async function PreviewPage() {
  await connection();
  if (process.env.NODE_ENV === "production") notFound();
  return <Preview />;
}
