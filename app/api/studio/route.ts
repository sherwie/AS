import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const rootDir = process.cwd();
    const manifestPath = path.join(
      rootDir,
      "public",
      "renders",
      "ep01-400-christmas-money-trap",
      "manifest.json"
    );
    const blueprintPath = path.join(
      rootDir,
      "pipeline",
      "blueprints",
      "ep01_christmas_400_plan.json"
    );
    const ep2BlueprintPath = path.join(
      rootDir,
      "pipeline",
      "blueprints",
      "ep02_january_debt_reset.json"
    );
    const roadmapPath = path.join(
      rootDir,
      "pipeline",
      "blueprints",
      "series_roadmap.json"
    );

    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
      : null;
    const blueprint = fs.existsSync(blueprintPath)
      ? JSON.parse(fs.readFileSync(blueprintPath, "utf-8"))
      : null;
    const ep2Blueprint = fs.existsSync(ep2BlueprintPath)
      ? JSON.parse(fs.readFileSync(ep2BlueprintPath, "utf-8"))
      : null;
    const roadmap = fs.existsSync(roadmapPath)
      ? JSON.parse(fs.readFileSync(roadmapPath, "utf-8"))
      : null;

    return NextResponse.json({
      status: manifest ? "ready" : "rendering",
      manifest,
      blueprint,
      ep2Blueprint,
      roadmap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
